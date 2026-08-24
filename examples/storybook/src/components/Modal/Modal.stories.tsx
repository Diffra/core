export default {
  title: 'Overlay/Modal',
  component: 'Modal',
};

export const ConfirmationDialog = {
  args: {
    title: 'Approve Baseline Changes?',
    body: 'Are you sure you want to promote 4 candidate screenshots to the main baseline?',
  },
  parameters: {
    diffra: {
      waitForSelector: '.modal-content',
      delay: 300,
    },
  },
};
