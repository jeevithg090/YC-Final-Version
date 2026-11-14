import { createWebAlert } from '../webAlert';

const setup = (confirmResult = true) => {
  const dialogs = { alert: jest.fn(), confirm: jest.fn(() => confirmResult) };
  return { dialogs, alert: createWebAlert(dialogs) };
};

describe('createWebAlert', () => {
  it('shows title and message in a browser alert', () => {
    const { dialogs, alert } = setup();
    alert('Saved', 'Your listing is live.');
    expect(dialogs.alert).toHaveBeenCalledWith('Saved\n\nYour listing is live.');
  });

  it('runs a single button after the alert closes', () => {
    const { alert } = setup();
    const onPress = jest.fn();
    alert('Done', undefined, [{ text: 'OK', onPress }]);
    expect(onPress).toHaveBeenCalled();
  });

  it('runs the confirming button when the user presses OK', () => {
    const { dialogs, alert } = setup(true);
    const onCancel = jest.fn();
    const onDelete = jest.fn();
    alert('Delete post?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel', onPress: onCancel },
      { text: 'Delete', style: 'destructive', onPress: onDelete },
    ]);
    expect(dialogs.confirm).toHaveBeenCalledWith('Delete post?\n\nThis cannot be undone.');
    expect(onDelete).toHaveBeenCalled();
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('runs the cancel button when the user dismisses', () => {
    const { alert } = setup(false);
    const onCancel = jest.fn();
    const onDelete = jest.fn();
    alert('Delete post?', undefined, [
      { text: 'Delete', onPress: onDelete },
      { text: 'Cancel', style: 'cancel', onPress: onCancel },
    ]);
    expect(onCancel).toHaveBeenCalled();
    expect(onDelete).not.toHaveBeenCalled();
  });
});
