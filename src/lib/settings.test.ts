import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	DEFAULT_KANBAN_VIEW_STATE,
	getPreloadedSettings,
	loadSettings,
	saveSettings,
} from "./settings";

const invokeMock = vi.hoisted(() => vi.fn());

vi.mock("@tauri-apps/api/core", () => ({
	invoke: invokeMock,
}));

function installLocalStorageMock() {
	const entries = new Map<string, string>();
	const storage = {
		get length() {
			return entries.size;
		},
		clear: vi.fn(() => entries.clear()),
		getItem: vi.fn((key: string) => entries.get(key) ?? null),
		key: vi.fn((index: number) => [...entries.keys()][index] ?? null),
		removeItem: vi.fn((key: string) => entries.delete(key)),
		setItem: vi.fn((key: string, value: string) =>
			entries.set(key, String(value)),
		),
	};
	Object.defineProperty(window, "localStorage", {
		configurable: true,
		value: storage,
	});
	vi.stubGlobal("localStorage", storage);
}

describe("settings", () => {
	beforeEach(() => {
		installLocalStorageMock();
		invokeMock.mockReset();
		window.localStorage.clear();
	});

	it("hydrates kanban view state with per-repo branches and inbox filters", async () => {
		invokeMock.mockResolvedValue({
			"app.kanban_view_state": JSON.stringify({
				createState: "backlog",
				repoId: "repo-1",
				inboxProviderTab: "github",
				inboxProviderSourceTab: "github_pr",
				sourceBranchByRepoId: {
					"repo-1": "release/next",
				},
				inboxStateFilterBySource: {
					github_pr: "merged",
				},
				openInboxCards: [],
			}),
		});

		const settings = await loadSettings();

		expect(settings.kanbanViewState).toMatchObject({
			createState: "backlog",
			repoId: "repo-1",
			inboxProviderSourceTab: "github_pr",
			sourceBranchByRepoId: {
				"repo-1": "release/next",
			},
			inboxStateFilterBySource: {
				github_pr: "merged",
			},
		});
	});

	it("keeps old kanban view state blobs compatible", async () => {
		invokeMock.mockResolvedValue({
			"app.kanban_view_state": JSON.stringify({
				createState: "in-progress",
				repoId: "repo-1",
				inboxProviderTab: "github",
				inboxProviderSourceTab: "github_issue",
				openInboxCards: [],
			}),
		});

		const settings = await loadSettings();

		expect(settings.kanbanViewState).toMatchObject({
			...DEFAULT_KANBAN_VIEW_STATE,
			repoId: "repo-1",
		});
	});

	it("saves kanban view state as one JSON blob", async () => {
		invokeMock.mockResolvedValue(undefined);

		await saveSettings({
			kanbanViewState: {
				...DEFAULT_KANBAN_VIEW_STATE,
				sourceBranchByRepoId: { "repo-1": "main" },
				inboxStateFilterBySource: { github_issue: "closed" },
			},
		});

		expect(invokeMock).toHaveBeenCalledWith(
			"update_app_settings",
			expect.objectContaining({
				settingsMap: expect.objectContaining({
					"app.kanban_view_state": expect.stringContaining(
						"sourceBranchByRepoId",
					),
				}),
			}),
		);
	});

	it("preloads terminal font from localStorage", () => {
		window.localStorage.setItem("helmor-terminal-font-family", "Berkeley Mono");

		const settings = getPreloadedSettings();

		expect(settings.terminalFontFamily).toBe("Berkeley Mono");
	});

	it("hydrates and saves terminal font from localStorage", async () => {
		window.localStorage.setItem(
			"helmor-terminal-font-family",
			"JetBrains Mono",
		);
		invokeMock.mockResolvedValue({});

		const settings = await loadSettings();

		expect(settings.terminalFontFamily).toBe("JetBrains Mono");

		await saveSettings({ terminalFontFamily: "Berkeley Mono" });
		expect(window.localStorage.getItem("helmor-terminal-font-family")).toBe(
			"Berkeley Mono",
		);

		await saveSettings({ terminalFontFamily: null });
		expect(
			window.localStorage.getItem("helmor-terminal-font-family"),
		).toBeNull();
	});

	it("hydrates and saves the last app surface", async () => {
		invokeMock.mockResolvedValue({
			"app.last_surface": "workspace-start",
			"app.start_context_panel_open": "true",
			"app.workspace_right_sidebar_mode": "context",
		});

		const settings = await loadSettings();

		expect(settings.lastSurface).toBe("workspace-start");
		expect(settings.startContextPanelOpen).toBe(true);
		expect(settings.workspaceRightSidebarMode).toBe("context");

		invokeMock.mockResolvedValue(undefined);
		await saveSettings({
			lastSurface: "workspace",
			startContextPanelOpen: false,
			workspaceRightSidebarMode: "inspector",
		});

		expect(invokeMock).toHaveBeenLastCalledWith(
			"update_app_settings",
			expect.objectContaining({
				settingsMap: expect.objectContaining({
					"app.last_surface": "workspace",
					"app.start_context_panel_open": "false",
					"app.workspace_right_sidebar_mode": "inspector",
				}),
			}),
		);
	});
});
