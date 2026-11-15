//! Diffra's pixel comparison engine, exposed to Node.js through Node-API.

use image::{DynamicImage, ImageBuffer, ImageFormat, Rgba, RgbaImage, load_from_memory};
use napi::bindgen_prelude::*;
use napi_derive::napi;
use std::io::Cursor;

/// Perceptual threshold used when none is given
#[napi]
pub const DEFAULT_THRESHOLD: f64 = 0.063;

/// Largest comparison, in pixels, that is attempted when no limit is given.
/// The comparison covers the larger of the two images in each dimension, so
/// two small images with different shapes can still ask for a huge canvas.
#[napi]
pub const DEFAULT_MAX_PIXELS: u32 = 100_000_000;

/// Edge length, in pixels, of the tiles that changed pixels are grouped into
const TILE_SIZE: u32 = 32;

/// Options for configuring pixel comparison
#[napi(object)]
#[derive(Debug, Clone)]
pub struct DiffOptions {
    /// Perceptual color threshold from 0.0 (exact match) to 1.0 (most permissive). Default: 0.063
    pub threshold: Option<f64>,
    /// Alias for threshold. Default: 0.063
    pub diff_threshold: Option<f64>,
    /// Whether to ignore subtle anti-aliasing differences. Default: false
    pub include_anti_aliasing: Option<bool>,
    /// Opacity of original pixels in the diff image (0.0 to 1.0). Default: 0.15
    pub alpha: Option<f64>,
    /// Diff pixel highlight color [R, G, B, A]. Default: [255, 0, 85, 255]
    pub diff_color: Option<Vec<u32>>,
    /// If true, renders a solid black background behind diff pixels. Default: false
    pub diff_mask: Option<bool>,
    /// Whether to encode and return a PNG diff image when the images differ.
    /// Identical images return none, since there is nothing to show. Default: true
    pub generate_diff_image: Option<bool>,
    /// The most pixels a comparison may cover, measured on the larger of the
    /// two images in each dimension. Larger comparisons are refused with an
    /// error before anything is allocated. Default: 100,000,000
    pub max_pixels: Option<u32>,
}

impl Default for DiffOptions {
    fn default() -> Self {
        Self {
            threshold: Some(DEFAULT_THRESHOLD),
            diff_threshold: Some(DEFAULT_THRESHOLD),
            include_anti_aliasing: Some(false),
            alpha: Some(0.15),
            diff_color: Some(vec![255, 0, 85, 255]),
            diff_mask: Some(false),
            generate_diff_image: Some(true),
            max_pixels: Some(DEFAULT_MAX_PIXELS),
        }
    }
}

/// Bounding box of a visual diff region
#[napi(object)]
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct BoundingBox {
    pub min_x: u32,
    pub min_y: u32,
    pub max_x: u32,
    pub max_y: u32,
}

/// Result of comparing two images
#[napi(object)]
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

/// Widens an RGBA pixel into floating point channels for color math
#[inline(always)]
fn rgba_f64(p: &Rgba<u8>) -> [f64; 4] {
    [p[0] as f64, p[1] as f64, p[2] as f64, p[3] as f64]
}

/// Calculate perceptual color difference between two RGBA pixels using YIQ color space
#[inline(always)]
fn color_delta_sq([r1, g1, b1, a1]: [f64; 4], [r2, g2, b2, a2]: [f64; 4]) -> f64 {
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
            let delta = color_delta_sq([tr, tg, tb, ta], rgba_f64(np));

            if delta < 1e-4 {
                zeroes += 1;
                if zeroes > 2 {
                    return false;
                }
            } else {
                let brightness_diff = (np[0] as f64 + np[1] as f64 + np[2] as f64) - (tr + tg + tb);
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

    let d1 = color_delta_sq(rgba_f64(other_target), rgba_f64(other_min));
    let d2 = color_delta_sq(rgba_f64(other_target), rgba_f64(other_max));

    d1 < 1.0 || d2 < 1.0
}

/// Records which tiles of an image contain a changed pixel
struct TileGrid {
    width: u32,
    height: u32,
    grid_w: u32,
    grid_h: u32,
    tiles: Vec<bool>,
}

impl TileGrid {
    fn new(width: u32, height: u32) -> Self {
        let grid_w = width.div_ceil(TILE_SIZE);
        let grid_h = height.div_ceil(TILE_SIZE);
        Self {
            width,
            height,
            grid_w,
            grid_h,
            tiles: vec![false; grid_w as usize * grid_h as usize],
        }
    }

    fn mark(&mut self, x: u32, y: u32) {
        let index = (y / TILE_SIZE) as usize * self.grid_w as usize + (x / TILE_SIZE) as usize;
        self.tiles[index] = true;
    }
}

/// Group neighbouring changed tiles into bounding boxes
fn cluster_bounding_boxes(tiles: TileGrid) -> Vec<BoundingBox> {
    let TileGrid {
        width,
        height,
        grid_w,
        grid_h,
        tiles: grid,
    } = tiles;
    if !grid.iter().any(|&changed| changed) {
        return Vec::new();
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

/// Compares two decoded images pixel by pixel on the current thread
pub fn compare_rgba_images(
    baseline: &RgbaImage,
    candidate: &RgbaImage,
    options: DiffOptions,
) -> Result<DiffResult> {
    let (bw, bh) = baseline.dimensions();
    let (cw, ch) = candidate.dimensions();

    let is_same_dimensions = bw == cw && bh == ch;
    let width = bw.max(cw);
    let height = bh.max(ch);

    // The diff covers the larger image in each dimension, so it can be far
    // bigger than either input. Refuse before allocating it.
    let max_pixels = u64::from(options.max_pixels.unwrap_or(DEFAULT_MAX_PIXELS));
    let canvas_pixels = u64::from(width) * u64::from(height);
    if canvas_pixels > max_pixels {
        return Err(Error::new(
            Status::InvalidArg,
            format!(
                "Images are too large to compare: baseline {bw}x{bh} and candidate {cw}x{ch} cover {width}x{height}, over the limit of {max_pixels} pixels"
            ),
        ));
    }

    let threshold = options
        .diff_threshold
        .or(options.threshold)
        .unwrap_or(DEFAULT_THRESHOLD)
        .clamp(0.0, 1.0);
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

    // Anti-aliasing looks at a pixel's neighbours in both images, so it must
    // stay inside the region the two images share. Scanning with either
    // image's own size reads past the edge of the smaller one.
    let shared_width = bw.min(cw);
    let shared_height = bh.min(ch);

    let mut diff_img: RgbaImage = ImageBuffer::new(width, height);
    let mut diff_count: u32 = 0;
    let mut changed_tiles = TileGrid::new(width, height);

    for y in 0..height {
        for x in 0..width {
            let in_baseline = x < bw && y < bh;
            let in_candidate = x < cw && y < ch;

            if in_baseline && in_candidate {
                let p1 = baseline.get_pixel(x, y);
                let p2 = candidate.get_pixel(x, y);

                let delta = color_delta_sq(rgba_f64(p1), rgba_f64(p2));

                if delta > max_delta {
                    let is_aa = !include_aa
                        && (is_antialiased(baseline, x, y, shared_width, shared_height, candidate)
                            || is_antialiased(
                                candidate,
                                x,
                                y,
                                shared_width,
                                shared_height,
                                baseline,
                            ));

                    if !is_aa {
                        diff_count += 1;
                        changed_tiles.mark(x, y);
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
                changed_tiles.mark(x, y);
                if generate_image {
                    diff_img.put_pixel(x, y, diff_pixel);
                }
            }
        }
    }

    let total_pixels = canvas_pixels as f64;
    let diff_percentage = if total_pixels > 0.0 {
        (diff_count as f64 / total_pixels) * 100.0
    } else {
        0.0
    };

    let bounding_boxes = cluster_bounding_boxes(changed_tiles);

    let diff_image = if generate_image && diff_count > 0 {
        let mut bytes: Vec<u8> = Vec::new();
        let mut cursor = Cursor::new(&mut bytes);
        DynamicImage::ImageRgba8(diff_img)
            .write_to(&mut cursor, ImageFormat::Png)
            .ok()
            .map(|_| Buffer::from(bytes))
    } else {
        None
    };

    Ok(DiffResult {
        diff_count,
        diff_percentage,
        is_same_dimensions,
        width,
        height,
        bounding_boxes,
        diff_image,
        has_diff: diff_count > 0,
    })
}

/// Decodes an encoded image into RGBA pixels, naming which input failed
fn decode(name: &str, bytes: &[u8]) -> Result<RgbaImage> {
    load_from_memory(bytes)
        .map(|image| image.to_rgba8())
        .map_err(|e| {
            Error::new(
                Status::InvalidArg,
                format!("Failed to decode {name} image: {e}"),
            )
        })
}

/// Wraps raw RGBA bytes of a known size, naming which input was the wrong size
fn rgba_image(name: &str, bytes: &[u8], width: u32, height: u32) -> Result<RgbaImage> {
    let expected = (width as usize) * (height as usize) * 4;
    if bytes.len() != expected {
        return Err(Error::new(
            Status::InvalidArg,
            format!(
                "{name} has {} bytes but a {width}x{height} RGBA image needs {expected}",
                bytes.len()
            ),
        ));
    }
    RgbaImage::from_raw(width, height, bytes.to_vec()).ok_or_else(|| {
        Error::new(
            Status::InvalidArg,
            format!("{name} is not a valid RGBA image"),
        )
    })
}

/// Decodes and compares two encoded images on the libuv thread pool
pub struct CompareImagesTask {
    baseline: Buffer,
    candidate: Buffer,
    options: DiffOptions,
}

impl Task for CompareImagesTask {
    type Output = DiffResult;
    type JsValue = DiffResult;

    fn compute(&mut self) -> Result<DiffResult> {
        let baseline = decode("baseline", &self.baseline)?;
        let candidate = decode("candidate", &self.candidate)?;
        compare_rgba_images(&baseline, &candidate, self.options.clone())
    }

    fn resolve(&mut self, _env: Env, output: DiffResult) -> Result<DiffResult> {
        Ok(output)
    }
}

/// Compare two encoded images (PNG). Decoding and comparison run off the main
/// thread, so several comparisons can proceed at once.
#[napi(ts_return_type = "Promise<DiffResult>")]
pub fn compare_images(
    baseline: Buffer,
    candidate: Buffer,
    options: Option<DiffOptions>,
) -> AsyncTask<CompareImagesTask> {
    AsyncTask::new(CompareImagesTask {
        baseline,
        candidate,
        options: options.unwrap_or_default(),
    })
}

/// Compare two raw RGBA buffers of the same width and height
#[napi(js_name = "compareRawRGBA")]
pub fn compare_raw_rgba(
    baseline: Buffer,
    candidate: Buffer,
    width: u32,
    height: u32,
    options: Option<DiffOptions>,
) -> Result<DiffResult> {
    compare_rgba_images(
        &rgba_image("baseline", &baseline, width, height)?,
        &rgba_image("candidate", &candidate, width, height)?,
        options.unwrap_or_default(),
    )
}

/// A decoded image as RGBA, 8 bits per channel
#[napi(object)]
pub struct DecodedPng {
    pub width: u32,
    pub height: u32,
    pub data: Buffer,
}

/// Decode a PNG into RGBA pixels
#[napi]
pub fn decode_png(png: Buffer) -> Result<DecodedPng> {
    let image = decode("PNG", &png)?;
    let (width, height) = image.dimensions();
    Ok(DecodedPng {
        width,
        height,
        data: Buffer::from(image.into_raw()),
    })
}

/// Encode RGBA pixels as a PNG
#[napi]
pub fn encode_png(rgba: Buffer, width: u32, height: u32) -> Result<Buffer> {
    let image = rgba_image("RGBA data", &rgba, width, height)?;
    let mut bytes: Vec<u8> = Vec::new();
    DynamicImage::ImageRgba8(image)
        .write_to(&mut Cursor::new(&mut bytes), ImageFormat::Png)
        .map_err(|e| Error::new(Status::GenericFailure, format!("Failed to encode PNG: {e}")))?;
    Ok(Buffer::from(bytes))
}
