export default {
  title: 'Components/Badge',
  component: 'Badge',
};

export const LiveIndicator = {
  args: {
    text: 'Active',
    color: 'green',
  },
};

export const DisabledSnapshotStory = {
  args: {
    text: 'Skipped Animation',
  },
  parameters: {
    visual: {
      disable: true,
    },
  },
};

export const SkippedStoryVisual = {
  args: {
    text: 'Dynamic Timestamp',
  },
  parameters: {
    visual: {
      disable: true,
    },
  },
};
