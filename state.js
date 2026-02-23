import { initializeApp } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";

export let mermaidInitialized = false;
export let mermaidLoadPromise = null;

export function setMermaidInitialized(value) {
    mermaidInitialized = value;
}

export function setMermaidLoadPromise(value) {
    mermaidLoadPromise = value;
}

export const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash';

export const appState = {
    currentUser: null,
    currentView: 'login', // 'login', 'student', 'teacher'
    geminiApiKey: null,
    geminiModel: DEFAULT_GEMINI_MODEL,
    teacherGeminiModel: DEFAULT_GEMINI_MODEL, // Added dynamically previously, explicitly declare here
    assignments: [], // Holds the currently displayed list of assignments (paginated)
    allSubmissions: [],
    allClasses: [],
    calendarFilterDate: null,
    calendarDisplayDate: null,
    currentAssignment: null,
    currentPage: 1,
    currentArticlePage: 1,
    currentSelectionRange: null,
    isEventListenersInitialized: false,
    cooldownIntervalId: null, // Track cooldown
    quizTimer: {
        startTime: null,
        intervalId: null,
        elapsedSeconds: 0
    },
    // New state for server-side pagination
    articleQueryState: {
        lastVisible: null, // Stores the last document snapshot for pagination
        isLoading: false,
        isLastPage: false,
        filters: {
            format: '',
            contentType: '',
            difficulty: '',
            status: ''
        }
    },
    teacherArticleQueryState: {
        lastVisible: null,
        isLoading: false,
        isLastPage: false,
        articles: [],
        filters: {
            searchTerm: '',
            format: '',
            contentType: '',
            difficulty: '',
            deadlineStatus: ''
        }
    }
};

appState.cache = {
    assignments: null,
    lastFetch: 0,
};

export const ARTICLES_PER_PAGE = 9;
export const TEACHER_PASSWORD_HASH = "8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918";

// Centralized DOM element references for non-modal elements
export const dom = {
    appLoader: document.getElementById('app-loader'),
    loginView: document.getElementById('login-view'),
    mainAppView: document.getElementById('main-app-view'),
    modalContainer: document.getElementById('modal-container'),
    highlightToolbar: document.getElementById('highlight-toolbar'),
};

const firebaseConfig = {
    apiKey: "AIzaSyB8uTu47VRp8WKnZ5QJ5IaVH1X2K2SJQwo",
    authDomain: "my-reading-platform.firebaseapp.com",
    projectId: "my-reading-platform",
    storageBucket: "my-reading-platform.firebasestorage.app",
    messagingSenderId: "200192012324",
    appId: "1:200192012324:web:fa181310ca103e269268b1"
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-reading-app-adventure-v2-full';
