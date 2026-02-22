import { appState, TEACHER_PASSWORD_HASH, dom, auth, db, appId } from './state.js';
import { hashString, generateDefaultPassword, getLocalDateString } from './utils.js';
import { renderModal, showLoading, hideLoading } from './ui.js';
import { loadStudentSubmissions } from './api.js';
import { signInAnonymously, onAuthStateChanged, signOut, signInWithCustomToken } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-auth.js";
import { doc, getDoc, updateDoc, Timestamp, collection, getDocs, query, where, setDoc } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";

// Import UI functions from script.js
import { showView, updateHeader, loadAllData, showArticleGrid, processUserLogin } from './scripts.js';
import { checkAndAwardAchievements } from './student.js';

export async function handleStudentLogin() {
    const errorEl = document.getElementById('login-error');
    errorEl.textContent = '';
    const classId = document.getElementById('class-login-selector').value;
    const studentId = document.getElementById('student-login-selector').value;
    const passwordInput = document.getElementById('student-password-input').value;

    if (!classId || !studentId || !passwordInput) {
        errorEl.textContent = '請選擇學堂、姓名並輸入憑信！';
        return;
    }

    try {
        const studentDocRef = doc(db, `classes/${classId}/students`, studentId);
        const studentDoc = await getDoc(studentDocRef);

        if (!studentDoc.exists()) {
            errorEl.textContent = '查無此學子！';
            return;
        }

        const studentData = studentDoc.data();
        const selectedClass = appState.allClasses.find(c => c.id === classId);
        const className = selectedClass ? selectedClass.className : '未知班級';

        const defaultPassword = generateDefaultPassword(className, studentData.seatNumber);
        const passwordHashOnRecord = studentData.passwordHash || await hashString(defaultPassword);
        const enteredPasswordHash = await hashString(passwordInput);

        if (enteredPasswordHash !== passwordHashOnRecord) {
            errorEl.textContent = '憑信有誤！';
            setTimeout(() => errorEl.textContent = '', 3000);
            return;
        }

        appState.currentUser = { type: 'student', studentId, name: studentData.name, seatNumber: studentData.seatNumber, classId, className, ...studentData };
        localStorage.setItem(`currentUser_${appId}`, JSON.stringify(appState.currentUser));

        // --- Streak Calculation on Login (統一使用 processUserLogin) ---
        await processUserLogin(studentData, studentId, classId);

        await loadStudentSubmissions(appState.currentUser.studentId);
        showView('app');
        requestAnimationFrame(updateHeader);
        document.getElementById('teacher-view-btn').classList.add('hidden');

    } catch (error) {
        console.error("Error during student login:", error);
        errorEl.textContent = '登入時發生錯誤，請稍後再試。';
    }
}

export async function handleTeacherLogin() {
    const passwordInput = document.getElementById('password-input').value.trim();
    const errorEl = document.getElementById('password-error');
    if (errorEl) errorEl.textContent = '';

    try {
        const teacherUserRef = doc(db, "classes/teacher_class/students", "teacher_user");
        const teacherUserSnap = await getDoc(teacherUserRef);

        let passwordHashOnRecord;
        const teacherData = teacherUserSnap.exists() ? teacherUserSnap.data() : {};

        if (teacherUserSnap.exists() && teacherData.passwordHash) {
            passwordHashOnRecord = teacherData.passwordHash;
        } else {
            passwordHashOnRecord = TEACHER_PASSWORD_HASH; // Fallback to hardcoded hash
        }

        const enteredPasswordHash = await hashString(passwordInput);

        if (enteredPasswordHash === passwordHashOnRecord) {
            appState.currentUser = { type: 'teacher', name: '筱仙', studentId: 'teacher_user', classId: 'teacher_class', className: '教師講堂', ...teacherData };
            localStorage.setItem(`currentUser_${appId}`, JSON.stringify(appState.currentUser));

            await processUserLogin(teacherData, 'teacher_user', 'teacher_class');

            await loadStudentSubmissions(appState.currentUser.studentId);
            appState.currentView = 'teacher';
            showView('app');
            requestAnimationFrame(updateHeader);
            document.getElementById('teacher-view-btn').classList.remove('hidden');
            document.getElementById('view-tabs').classList.remove('hidden');
            closeModal();
        } else {
            if (errorEl) errorEl.textContent = '憑信錯誤。';
        }
    } catch (error) {
        console.error("Teacher login error:", error);
        if (errorEl) errorEl.textContent = '驗證時發生錯誤。';
    }
}

export async function handleLogout() {
    try {
        await signOut(auth);
        localStorage.removeItem(`currentUser_${appId}`);
        location.reload();
    } catch (error) {
        console.error("Logout failed:", error);
        // Even if signout fails, force a refresh to a clean state
        location.reload();
    }
}

export async function handleChangePassword() {
    const errorEl = document.getElementById('change-password-error');
    errorEl.textContent = '';
    const currentPassword = document.getElementById('current-password').value;
    const newPassword = document.getElementById('new-password').value;
    const confirmNewPassword = document.getElementById('confirm-new-password').value;

    if (!currentPassword || !newPassword || !confirmNewPassword) {
        errorEl.textContent = '所有欄位皆為必填。';
        return;
    }
    if (newPassword !== confirmNewPassword) {
        errorEl.textContent = '新密語與確認密語不相符。';
        return;
    }
    if (newPassword.length < 4) {
        errorEl.textContent = '新密語長度至少需要四個字元。';
        return;
    }

    showLoading('正在驗證與更新密語...');

    try {
        const currentUser = appState.currentUser;
        if (!currentUser) {
            throw new Error("User not logged in.");
        }

        // --- Teacher Password Change Logic ---
        if (currentUser.type === 'teacher') {
            const teacherUserRef = doc(db, "classes/teacher_class/students", "teacher_user");
            const teacherUserSnap = await getDoc(teacherUserRef);

            let currentPasswordHash;
            if (teacherUserSnap.exists() && teacherUserSnap.data().passwordHash) {
                currentPasswordHash = teacherUserSnap.data().passwordHash;
            } else {
                currentPasswordHash = TEACHER_PASSWORD_HASH; // Fallback to hardcoded hash
            }

            const enteredCurrentHash = await hashString(currentPassword);
            if (enteredCurrentHash !== currentPasswordHash) {
                errorEl.textContent = '舊密語錯誤。';
                return;
            }

            const newPasswordHash = await hashString(newPassword);
            // Use setDoc with merge to create or update the teacher document safely
            await setDoc(teacherUserRef, { passwordHash: newPasswordHash }, { merge: true });

            closeModal();
            renderModal('message', { title: '成功', message: '憑信已成功修訂。' });

            // --- Student Password Change Logic ---
        } else if (currentUser.type === 'student') {
            const studentDocRef = doc(db, `classes/${currentUser.classId}/students`, currentUser.studentId);
            const studentDocSnap = await getDoc(studentDocRef);

            if (!studentDocSnap.exists()) {
                errorEl.textContent = '找不到您的學生資料。';
                return;
            }

            const studentDocData = studentDocSnap.data();
            const selectedClass = appState.allClasses.find(c => c.id === currentUser.classId);
            const defaultPassword = generateDefaultPassword(selectedClass.className, studentDocData.seatNumber);

            const currentPasswordHashOnRecord = studentDocData.passwordHash || await hashString(defaultPassword);
            const enteredCurrentPasswordHash = await hashString(currentPassword);

            if (enteredCurrentPasswordHash !== currentPasswordHashOnRecord) {
                errorEl.textContent = '舊密語有誤。';
                return;
            }

            const newPasswordHash = await hashString(newPassword);
            await updateDoc(studentDocRef, { passwordHash: newPasswordHash });

            closeModal();
            renderModal('message', { type: 'success', title: '更新成功', message: '憑信已成功修訂！' });
        } else {
            throw new Error("Unknown user type.");
        }
    } catch (error) {
        console.error("Password change failed:", error);
        errorEl.textContent = '更新密語時發生錯誤。';
    } finally {
        hideLoading();
    }
}


export function initializeAuthObserver() {
    // 認證狀態監聽（目前由匿名登入處理，保留擴充介面）
}

window.handleTeacherLogin = handleTeacherLogin;
window.handleChangePassword = handleChangePassword;
