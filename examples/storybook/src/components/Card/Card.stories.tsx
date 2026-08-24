export default {
  title: 'Design System/Card',
  component: 'Card',
  parameters: {
    diffra: {
      delay: 200,
    },
  },
};

export const Standard = {
  args: {
    title: 'Self-Hosted Analytics',
    description:
      'Track real-time visual regressions on your own infrastructure with zero cloud lock-in.',
    badge: 'NEW',
  },
};

export const Featured = {
  args: {
    title: 'Enterprise Architecture',
    description:
      'SIMD-accelerated Rust pixel diff engine scaling across thousands of components.',
    featured: true,
  },
  parameters: {
    diffra: {
      threshold: 0.02,
      viewports: [
        { name: 'tablet', width: 768, height: 1024 },
        { name: 'desktop', width: 1440, height: 900 },
      ],
    },
  },
};
