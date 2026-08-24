export default {
  title: 'Components/Button',
  component: 'Button',
  parameters: {
    diffra: {
      threshold: 0.05,
    },
  },
};

export const Primary = {
  args: {
    label: 'Get Started Now',
    variant: 'primary',
  },
};

export const Secondary = {
  args: {
    label: 'Learn More',
    variant: 'secondary',
  },
};

export const DangerHoverState = {
  args: {
    label: 'Delete Project',
    variant: 'danger',
  },
  parameters: {
    diffra: {
      hover: 'button.btn-danger',
      delay: 250,
    },
  },
};

export const ResponsiveMatrix = {
  args: {
    label: 'Responsive Button',
    variant: 'primary',
  },
  parameters: {
    diffra: {
      viewports: [375, 768, 1280],
    },
  },
};
