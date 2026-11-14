import { NON_LINKABLE_SCREENS, PUBLIC_SCREENS, SCREEN_PATHS, getPathFromState, getStateFromPath } from '../linking';

jest.mock('expo-linking', () => ({ createURL: (path: string) => `http://localhost${path}` }));

const leaf = (path: string) => {
  const state = getStateFromPath(path);
  return state?.routes[state.routes.length - 1];
};

describe('linking', () => {
  it('maps friendly URLs to screens', () => {
    expect(leaf('/login')?.name).toBe('Login');
    expect(leaf('/home')?.name).toBe('Dashboard');
    expect(leaf('/rides/cab/abc123')).toMatchObject({ name: 'CabRideDetails', params: { rideId: 'abc123' } });
  });

  it('sends unknown URLs to the not-found screen', () => {
    expect(leaf('/this/does/not/exist')?.name).toBe('NotFound');
  });

  it('does not open screens that need in-memory params from a URL', () => {
    expect(leaf('/chat')?.name).toBe('NotFound');
    expect(leaf('/marketplace/chat')?.name).toBe('NotFound');
  });

  it('keeps object params out of the URL', () => {
    const path = getPathFromState({
      routes: [{ name: 'Chat', params: { currentUser: { id: 'u1' }, selectedUser: { id: 'u2' } } }],
    } as never);
    expect(path).toBe('/chat');
  });

  it('keeps primitive params', () => {
    const path = getPathFromState({ routes: [{ name: 'QnaForumPost', params: { questionId: 'q1' } }] } as never);
    expect(path).toBe('/qna/q1');
  });

  it('gives every screen a unique path', () => {
    const paths = Object.values(SCREEN_PATHS);
    expect(new Set(paths).size).toBe(paths.length);
  });

  it('only marks entry and auth screens as public', () => {
    expect(PUBLIC_SCREENS.has('Login')).toBe(true);
    expect(PUBLIC_SCREENS.has('Dashboard')).toBe(false);
    for (const name of NON_LINKABLE_SCREENS) expect(SCREEN_PATHS).toHaveProperty(name);
  });
});
