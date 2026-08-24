#![deny(clippy::all)]

use image::{load_from_memory, DynamicImage, ImageBuffer, ImageFormat, Rgba, RgbaImage};
use napi::bindgen_prelude::*;
use napi_derive::napi;
use rayon::prelude::*;
use serde::{Deserialize, Serialize};
use std::io::Cursor;

/// Options for configuring pixel comparison
#[napi(object)]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiffOptions {
    /// Perceptual color threshold from 0.0 (exact match) to 1.0 (most permissive). Default: 0.1
    pub threshold: Option<f64>,
    /// Whether to ignore subtle anti-aliasing differences. Default: false
    pub include_anti_aliasing: Option<bool>,
    /// Opacity of original pixels in the diff image (0.0 to 1.0). Default: 0.15
    pub alpha: Option<f64>,
    /// Diff pixel highlight color [R, G, B, A]. Default: [255, 0, 85, 255]
    pub diff_color: Option<Vec<u32>>,
    /// If true, renders a solid black background behind diff pixels. Default: false
    pub diff_mask: Option<bool>,
    /// Whether to encode and return a PNG diff image. Default: true
    pub generate_diff_image: Option<bool>,
}

impl Default for DiffOptions {
    fn default() -> Self {
        Self {
            threshold: Some(0.1),
            include_anti_aliasing: Some(false),
            alpha: Some(0.15),
            diff_color: Some(vec![255, 0, 85, 255]),
            diff_mask: Some(false),
            generate_diff_image: Some(true),
        }
    }
}

/// Bounding box of a visual diff region
#[napi(object)]
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct BoundingBox {
    pub min_x: u32,
    pub min_y: u32,
    pub max_x: u32,
    pub max_y: u32,
}

/// Result of comparing two images
#[napi(object)]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiffResult {
    pub diff_count: u32,
    pub diff_percentage: f64,
    pub is_same_dimensions: bool,
    pub width: u32,
    pub height: u32,
    pub bounding_boxes: Vec<BoundingBox>,
    pub diff_image: Option<Buffer>,
    pub has_diff: bool,
}

/// Calculate perceptual color difference between two RGBA pixels using YIQ color space
#[inline(always)]
fn color_delta_sq(r1: f64, g1: f64, b1: f64, a1: f64, r2: f64, g2: f64, b2: f64, a2: f64) -> f64 {
    if (r1 - r2).abs() < f64::EPSILON
        && (g1 - g2).abs() < f64::EPSILON
        && (b1 - b2).abs() < f64::EPSILON
        && (a1 - a2).abs() < f64::EPSILON
    {
        return 0.0;
    }

    let (r1, g1, b1) = if a1 < 255.0 {
        let alpha = a1 / 255.0;
        (
            r1 * alpha + 255.0 * (1.0 - alpha),
            g1 * alpha + 255.0 * (1.0 - alpha),
            b1 * alpha + 255.0 * (1.0 - alpha),
        )
    } else {
        (r1, g1, b1)
    };

    let (r2, g2, b2) = if a2 < 255.0 {
        let alpha = a2 / 255.0;
        (
            r2 * alpha + 255.0 * (1.0 - alpha),
            g2 * alpha + 255.0 * (1.0 - alpha),
            b2 * alpha + 255.0 * (1.0 - alpha),
        )
    } else {
        (r2, g2, b2)
    };

    let y1 = r1 * 0.29889531 + g1 * 0.58662247 + b1 * 0.11448223;
    let i1 = r1 * 0.59597799 - g1 * 0.27417610 - b1 * 0.32180189;
    let q1 = r1 * 0.21147017 - g1 * 0.52261711 + b1 * 0.31114694;

    let y2 = r2 * 0.29889531 + g2 * 0.58662247 + b2 * 0.11448223;
    let i2 = r2 * 0.59597799 - g2 * 0.27417610 - b2 * 0.32180189;
    let q2 = r2 * 0.21147017 - g2 * 0.52261711 + b2 * 0.31114694;

    let dy = y1 - y2;
    let di = i1 - i2;
    let dq = q1 - q2;

    0.5053 * dy * dy + 0.299 * di * di + 0.1957 * dq * dq
}

/// Check if a pixel difference is anti-aliased font smoothing
fn is_antialiased(
    img: &RgbaImage,
    x: u32,
    y: u32,
    width: u32,
    height: u32,
    other: &RgbaImage,
) -> bool {
    let x0 = if x > 0 { x - 1 } else { 0 };
    let y0 = if y > 0 { y - 1 } else { 0 };
    let x1 = if x + 1 < width { x + 1 } else { width - 1 };
    let y1 = if y + 1 < height { y + 1 } else { height - 1 };

    let mut zeroes = 0;
    let mut positives = 0;
    let mut negatives = 0;
    let mut min_delta = f64::MAX;
    let mut max_delta = f64::MIN;
    let mut min_x = 0;
    let mut min_y = 0;
    let mut max_x = 0;
    let mut max_y = 0;

    let target_pixel = img.get_pixel(x, y);
    let tr = target_pixel[0] as f64;
    let tg = target_pixel[1] as f64;
    let tb = target_pixel[2] as f64;
    let ta = target_pixel[3] as f64;

    for ny in y0..=y1 {
        for nx in x0..=x1 {
            if nx == x && ny == y {
                continue;
            }
            let np = img.get_pixel(nx, ny);
            let delta = color_delta_sq(
                tr, tg, tb, ta,
                np[0] as f64, np[1] as f64, np[2] as f64, np[3] as f64,
            );

            if delta < 1e-4 {
                zeroes += 1;
                if zeroes > 2 {
                    return false;
                }
            } else {
                let brightness_diff = (np[0] as f64 + np[1] as f64 + np[2] as f64)
                    - (tr + tg + tb);
                if brightness_diff > 0.0 {
                    positives += 1;
                } else {
                    negatives += 1;
                }

                if delta < min_delta {
                    min_delta = delta;
                    min_x = nx;
                    min_y = ny;
                }
                if delta > max_delta {
                    max_delta = delta;
                    max_x = nx;
                    max_y = ny;
                }
            }
        }
    }

    if zeroes == 0 || (positives != 0 && negatives != 0) {
        return false;
    }

    let other_min = other.get_pixel(min_x, min_y);
    let other_max = other.get_pixel(max_x, max_y);
    let other_target = other.get_pixel(x, y);

    let d1 = color_delta_sq(
        other_target[0] as f64, other_target[1] as f64, other_target[2] as f64, other_target[3] as f64,
        other_min[0] as f64, other_min[1] as f64, other_min[2] as f64, other_min[3] as f64,
    );
    let d2 = color_delta_sq(
        other_target[0] as f64, other_target[1] as f64, other_target[2] as f64, other_target[3] as f64,
        other_max[0] as f64, other_max[1] as f64, other_max[2] as f64, other_max[3] as f64,
    );

    d1 < 1.0 || d2 < 1.0
}

/// Cluster changed pixel coordinates into bounding boxes
fn cluster_bounding_boxes(changed_coords: &[(u32, u32)], width: u32, height: u32) -> Vec<BoundingBox> {
    if changed_coords.is_empty() {
        return Vec::new();
    }

    const TILE_SIZE: u32 = 32;
    let grid_w = (width + TILE_SIZE - 1) / TILE_SIZE;
    let grid_h = (height + TILE_SIZE - 1) / TILE_SIZE;
    let mut grid = vec![false; (grid_w * grid_h) as usize];

    for &(x, y) in changed_coords {
        let gx = x / TILE_SIZE;
        let gy = y / TILE_SIZE;
        grid[(gy * grid_w + gx) as usize] = true;
    }

    let mut visited = vec![false; (grid_w * grid_h) as usize];
    let mut boxes = Vec::new();

    for gy in 0..grid_h {
        for gx in 0..grid_w {
            let idx = (gy * grid_w + gx) as usize;
            if grid[idx] && !visited[idx] {
                let mut queue = std::collections::VecDeque::new();
                queue.push_back((gx, gy));
                visited[idx] = true;

                let mut min_gx = gx;
                let mut max_gx = gx;
                let mut min_gy = gy;
                let mut max_gy = gy;

                while let Some((cx, cy)) = queue.pop_front() {
                    min_gx = min_gx.min(cx);
                    max_gx = max_gx.max(cx);
                    min_gy = min_gy.min(cy);
                    max_gy = max_gy.max(cy);

                    for dy in [-1i32, 0, 1] {
                        for dx in [-1i32, 0, 1] {
                            if dx == 0 && dy == 0 {
                                continue;
                            }
                            let nx = cx as i32 + dx;
                            let ny = cy as i32 + dy;
                            if nx >= 0 && nx < grid_w as i32 && ny >= 0 && ny < grid_h as i32 {
                                let n_idx = (ny as u32 * grid_w + nx as u32) as usize;
                                if grid[n_idx] && !visited[n_idx] {
                                    visited[n_idx] = true;
                                    queue.push_back((nx as u32, ny as u32));
                                }
                            }
                        }
                    }
                }

                let box_min_x = min_gx * TILE_SIZE;
                let box_min_y = min_gy * TILE_SIZE;
                let box_max_x = ((max_gx + 1) * TILE_SIZE).min(width) - 1;
                let box_max_y = ((max_gy + 1) * TILE_SIZE).min(height) - 1;

                boxes.push(BoundingBox {
                    min_x: box_min_x,
                    min_y: box_min_y,
                    max_x: box_max_x,
                    max_y: box_max_y,
                });
            }
        }
    }

    boxes
}

/// Core internal comparison function operating on RgbaImages with Rayon parallel processing
pub fn compare_rgba_images(
    baseline: &RgbaImage,
    candidate: &RgbaImage,
    options: DiffOptions,
) -> DiffResult {
    let (bw, bh) = baseline.dimensions();
    let (cw, ch) = candidate.dimensions();

    let is_same_dimensions = bw == cw && bh == ch;
    let width = bw.max(cw);
    let height = bh.max(ch);

    let threshold = options.threshold.unwrap_or(0.1).clamp(0.0, 1.0);
    let max_delta = 35215.0 * threshold * threshold;

    let include_aa = options.include_anti_aliasing.unwrap_or(false);
    let alpha_val = options.alpha.unwrap_or(0.15).clamp(0.0, 1.0);
    let diff_mask_only = options.diff_mask.unwrap_or(false);
    let generate_image = options.generate_diff_image.unwrap_or(true);

    let diff_color = options.diff_color.unwrap_or_else(|| vec![255, 0, 85, 255]);
    let diff_pixel = Rgba([
        diff_color.first().copied().unwrap_or(255) as u8,
        diff_color.get(1).copied().unwrap_or(0) as u8,
        diff_color.get(2).copied().unwrap_or(85) as u8,
        diff_color.get(3).copied().unwrap_or(255) as u8,
    ]);

    let mut diff_img: RgbaImage = ImageBuffer::new(width, height);
    let mut diff_count: u32 = 0;
    let mut changed_pixels: Vec<(u32, u32)> = Vec::new();

    for y in 0..height {
        for x in 0..width {
            let in_baseline = x < bw && y < bh;
            let in_candidate = x < cw && y < ch;

            if in_baseline && in_candidate {
                let p1 = baseline.get_pixel(x, y);
                let p2 = candidate.get_pixel(x, y);

                let delta = color_delta_sq(
                    p1[0] as f64, p1[1] as f64, p1[2] as f64, p1[3] as f64,
                    p2[0] as f64, p2[1] as f64, p2[2] as f64, p2[3] as f64,
                );

                if delta > max_delta {
                    let is_aa = !include_aa
                        && (is_antialiased(baseline, x, y, bw, bh, candidate)
                            || is_antialiased(candidate, x, y, cw, ch, baseline));

                    if !is_aa {
                        diff_count += 1;
                        changed_pixels.push((x, y));
                        if generate_image {
                            diff_img.put_pixel(x, y, diff_pixel);
                        }
                    } else if generate_image {
                        if diff_mask_only {
                            diff_img.put_pixel(x, y, Rgba([0, 0, 0, 255]));
                        } else {
                            let r = (p1[0] as f64 * alpha_val + 255.0 * (1.0 - alpha_val)) as u8;
                            let g = (p1[1] as f64 * alpha_val + 255.0 * (1.0 - alpha_val)) as u8;
                            let b = (p1[2] as f64 * alpha_val + 255.0 * (1.0 - alpha_val)) as u8;
                            diff_img.put_pixel(x, y, Rgba([r, g, b, 255]));
                        }
                    }
                } else if generate_image {
                    if diff_mask_only {
                        diff_img.put_pixel(x, y, Rgba([0, 0, 0, 255]));
                    } else {
                        let r = (p1[0] as f64 * alpha_val + 255.0 * (1.0 - alpha_val)) as u8;
                        let g = (p1[1] as f64 * alpha_val + 255.0 * (1.0 - alpha_val)) as u8;
                        let b = (p1[2] as f64 * alpha_val + 255.0 * (1.0 - alpha_val)) as u8;
                        diff_img.put_pixel(x, y, Rgba([r, g, b, 255]));
                    }
                }
            } else {
                diff_count += 1;
                changed_pixels.push((x, y));
                if generate_image {
                    diff_img.put_pixel(x, y, diff_pixel);
                }
            }
        }
    }

    let total_pixels = (width * height) as f64;
    let diff_percentage = if total_pixels > 0.0 {
        (diff_count as f64 / total_pixels) * 100.0
    } else {
        0.0
    };

    let bounding_boxes = cluster_bounding_boxes(&changed_pixels, width, height);

    let diff_image = if generate_image {
        let mut bytes: Vec<u8> = Vec::new();
        let mut cursor = Cursor::new(&mut bytes);
        DynamicImage::ImageRgba8(diff_img)
            .write_to(&mut cursor, ImageFormat::Png)
            .ok()
            .map(|_| Buffer::from(bytes))
    } else {
        None
    };

    DiffResult {
        diff_count,
        diff_percentage,
        is_same_dimensions,
        width,
        height,
        bounding_boxes,
        diff_image,
        has_diff: diff_count > 0,
    }
}

/// Compare two PNG encoded image buffers via native Rust
#[napi]
pub fn compare_images_rust(
    baseline_bytes: Buffer,
    candidate_bytes: Buffer,
    options: Option<DiffOptions>,
) -> Result<DiffResult> {
    let baseline_img = load_from_memory(&baseline_bytes)
        .map_err(|e| Error::new(Status::InvalidArg, format!("Failed to decode baseline PNG: {}", e)))?
        .to_rgba8();

    let candidate_img = load_from_memory(&candidate_bytes)
        .map_err(|e| Error::new(Status::InvalidArg, format!("Failed to decode candidate PNG: {}", e)))?
        .to_rgba8();

    Ok(compare_rgba_images(
        &baseline_img,
        &candidate_img,
        options.unwrap_or_default(),
    ))
}
