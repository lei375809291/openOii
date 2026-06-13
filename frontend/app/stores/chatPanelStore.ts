import { create } from "zustand";
import {
	createJSONStorage,
	persist,
	type StateStorage,
} from "zustand/middleware";

interface ChatPanelState {
	isOpen: boolean;
	toggle: () => void;
	open: () => void;
	close: () => void;
}

const fallbackStorage: StateStorage = (() => {
	const data = new Map<string, string>();
	return {
		getItem: (name) => data.get(name) ?? null,
		setItem: (name, value) => {
			data.set(name, value);
		},
		removeItem: (name) => {
			data.delete(name);
		},
	};
})();

function getStorage(): StateStorage {
	try {
		if (typeof window !== "undefined" && window.localStorage) {
			return window.localStorage;
		}
	} catch {
		// Non-browser tests can expose an unavailable localStorage object.
	}
	return fallbackStorage;
}

export const useChatPanelStore = create<ChatPanelState>()(
	persist(
		(set) => ({
			isOpen: false,
			toggle: () => set((state) => ({ isOpen: !state.isOpen })),
			open: () => set({ isOpen: true }),
			close: () => set({ isOpen: false }),
		}),
		{
			name: "openOii-chat-panel",
			storage: createJSONStorage(getStorage),
		}
	)
);
