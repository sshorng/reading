import { getDocs, query, collection, where, limit, orderBy } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";
import { db, appState } from './state.js';

export async function loadStudentSubmissions(studentId) {
    if (!studentId) return []; // Return empty array if no ID
    const submissionsQuery = query(
        collection(db, "submissions"),
        where('studentId', '==', studentId),
        limit(300) // 效能防護：限制單一學子最多抓取 300 筆最新紀錄
    );
    try {
        const snapshot = await getDocs(submissionsQuery);
        const submissions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        appState.allSubmissions = submissions; // Still update global state for other parts of the app
        return submissions; // Return the submissions array
    } catch (error) {
        console.error("Error fetching student submissions:", error);
        appState.allSubmissions = [];
        return []; // Return empty array on error
    }
}

export async function loadSubmissionsByClass(classId) {
    if (!classId) return [];
    const submissionsQuery = query(
        collection(db, "submissions"),
        where('classId', '==', classId),
        limit(1000) // 效能防護：限制單一學堂最多抓取 1000 筆最新紀錄
    );
    try {
        const snapshot = await getDocs(submissionsQuery);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        console.error("Error fetching submissions by class:", error);
        return [];
    }
}

export async function loadSubmissionsByAssignment(assignmentId) {
    if (!assignmentId) return [];
    const submissionsQuery = query(
        collection(db, "submissions"),
        where('assignmentId', '==', assignmentId)
    );
    try {
        const snapshot = await getDocs(submissionsQuery);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        console.error("Error fetching submissions by assignment:", error);
        return [];
    }
}

export async function getAssignments(forceRefresh = false) {
    const now = Date.now();
    const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

    if (!forceRefresh && appState.cache.assignments && (now - appState.cache.lastFetch < CACHE_DURATION)) {
        return appState.cache.assignments;
    }

    const assignmentsSnapshot = await getDocs(query(collection(db, "assignments"), orderBy("createdAt", "desc")));
    const assignments = assignmentsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
    }));

    appState.cache.assignments = assignments;
    appState.cache.lastFetch = now;

    return assignments;
}
