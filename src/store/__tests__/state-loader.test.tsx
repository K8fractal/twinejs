import {act, render, screen, waitFor} from '@testing-library/react';
import {StateLoader} from '../state-loader';
import {defaults, usePrefsContext} from '../prefs';
import {useStoriesContext} from '../stories';
import {useStoryFormatsContext, StoryFormat} from '../story-formats';
import {usePersistence} from '../persistence/use-persistence';
import {fakeUnloadedStoryFormat} from '../../test-util';

jest.mock('../prefs/prefs-context');
jest.mock('../stories/stories-context');
jest.mock('../story-formats/story-formats-context');
jest.mock('../persistence/use-persistence');
jest.mock('../../components/loading-curtain/loading-curtain');

describe('<StateLoader>', () => {
	let defaultFormat: StoryFormat;
	let prefsDispatchMock: jest.Mock;
	let formatsDispatchMock: jest.Mock;
	let storiesDispatchMock: jest.Mock;

	beforeEach(() => {
		defaultFormat = fakeUnloadedStoryFormat();
		prefsDispatchMock = jest.fn();
		formatsDispatchMock = jest.fn();
		storiesDispatchMock = jest.fn();

		(usePrefsContext as jest.Mock).mockReturnValue({
			dispatch: prefsDispatchMock,
			prefs: {
				storyFormat: {
					name: defaultFormat.name,
					version: defaultFormat.version
				}
			}
		});
		(useStoryFormatsContext as jest.Mock).mockReturnValue({
			dispatch: formatsDispatchMock,
			formats: [defaultFormat]
		});
		(useStoriesContext as jest.Mock).mockReturnValue({
			dispatch: storiesDispatchMock
		});
		(usePersistence as jest.Mock).mockReturnValue({
			prefs: {load: async () => ({mockPrefsState: true})},
			stories: {load: async () => ({mockStoriesState: true})},
			storyFormats: {load: async () => ({mockStoryFormatsState: true})}
		});
	});

	afterEach(async () => {
		await act(() => Promise.resolve());
	});

	it('dispatches init and repair actions once mounted', async () => {
		render(<StateLoader />);
		await waitFor(() => expect(prefsDispatchMock).toBeCalled());

		// Order of these actions is crucial. The init must come before the repair.

		expect(prefsDispatchMock.mock.calls).toEqual([
			[{type: 'init', state: {mockPrefsState: true}}],
			[{type: 'repair', allFormats: [defaultFormat]}]
		]);
		expect(storiesDispatchMock.mock.calls).toEqual([
			[{type: 'init', state: {mockStoriesState: true}}],
			[{type: 'repair', allFormats: [defaultFormat], defaultFormat}]
		]);
		expect(formatsDispatchMock.mock.calls).toEqual([
			[{type: 'init', state: {mockStoryFormatsState: true}}],
			[{type: 'repair'}]
		]);
	});

	it('renders children once loaded', async () => {
		render(
			<StateLoader>
				<div data-testid="children" />
			</StateLoader>
		);
		expect(screen.queryByTestId('children')).not.toBeInTheDocument();
		await waitFor(() =>
			expect(screen.getByTestId('children')).toBeInTheDocument()
		);
		expect(screen.getByTestId('children')).toBeInTheDocument();
	});

	it('falls back to the default story format if the user preference is for an nonexistent format', async () => {
		const defaultFormatProps = defaults().storyFormat;
		const defaultFormat = fakeUnloadedStoryFormat({
			name: defaultFormatProps.name,
			version: defaultFormatProps.version
		});

		(usePrefsContext as jest.Mock).mockReturnValue({
			dispatch: prefsDispatchMock,
			prefs: {
				storyFormat: {
					name: 'bad',
					version: '1.0.0'
				}
			}
		});
		(useStoryFormatsContext as jest.Mock).mockReturnValue({
			dispatch: formatsDispatchMock,
			formats: [defaultFormat]
		});

		render(<StateLoader />);
		await waitFor(() => expect(prefsDispatchMock).toBeCalled());
		expect(storiesDispatchMock.mock.calls).toEqual([
			[{type: 'init', state: {mockStoriesState: true}}],
			[
				{
					type: 'repair',
					allFormats: [defaultFormat],
					defaultFormat: defaultFormat
				}
			]
		]);
	});

	it("does not repair stories if even the default story format isn't available", async () => {
		jest.spyOn(console, 'error').mockReturnValue();
		(usePrefsContext as jest.Mock).mockReturnValue({
			dispatch: prefsDispatchMock,
			prefs: {
				storyFormat: {
					name: 'bad',
					version: '1.0.0'
				}
			}
		});
		render(<StateLoader />);
		await waitFor(() => expect(prefsDispatchMock).toBeCalled());
		expect(storiesDispatchMock.mock.calls).toEqual([
			[{type: 'init', state: {mockStoriesState: true}}]
		]);
	});
});
