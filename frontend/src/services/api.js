import axios from 'axios';

export const getBaseURL = () => {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  if (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
    if (window.location.port === '5173' || window.location.port === '5174') {
      return 'http://localhost:5001/api';
    }
  }
  return '/_/backend/api';
};

const API = axios.create({
  baseURL: getBaseURL(),
  timeout: 10000,
});

// Request interceptor to attach JWT token
API.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle errors globally (like deactivation/session expiration)
API.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      const isLoginRoute = error.config && error.config.url && error.config.url.includes('/auth/login');
      
      if (!isLoginRoute) {
        if (error.response.status === 401) {
          console.warn('Authentication failure or session expired. Logging out.');
          if (window.location.hash !== '#/') {
            localStorage.removeItem('token');
            localStorage.removeItem('activeUser');
            localStorage.removeItem('activeRole');
            alert('Session expired. Please login again.');
            window.location.href = '/';
          }
        } else if (error.response.status === 403) {
          console.warn('Role restriction: User tried to access forbidden resource.');
          // Do NOT logout automatically on 403. Let the specific page handle it or show a toast.
        }
      }
    }
    return Promise.reject(error);
  }
);

export const authAPI = {
  login: (email, password) => API.post('/auth/login', { email, password }),
  getMe: () => API.get('/auth/me'),
  updateProfile: (data) => API.put('/auth/profile', data),
};

export const adminAPI = {
  getDashboardStats: () => API.get('/admin/dashboard'),
  getTeachers: () => API.get('/admin/teachers'),
  createTeacher: (data) => API.post('/admin/teachers', data),
  updateTeacher: (id, data) => API.put(`/admin/teachers/${id}`, data),
  deleteTeacher: (id) => API.delete(`/admin/teachers/${id}`),
  getParents: () => API.get('/admin/parents'),
  createParent: (data) => API.post('/admin/parents', data),
  updateParent: (id, data) => API.put(`/admin/parents/${id}`, data),
  deleteParent: (id) => API.delete(`/admin/parents/${id}`),
  getStudents: () => API.get('/admin/students'),
  createStudent: (data) => API.post('/admin/students', data),
  updateStudent: (id, data) => API.put(`/admin/students/${id}`, data),
  deleteStudent: (id) => API.delete(`/admin/students/${id}`),
  getReports: () => API.get('/admin/reports'),
  getAuditLogs: (page = 1, limit = 25, search = '') => API.get('/admin/audit-logs', { params: { page, limit, search } }),
  getStaffAttendance: (page = 1, limit = 25) => API.get('/admin/staff-attendance', { params: { page, limit } }),
  getTasks: (page = 1, limit = 50) => API.get('/admin/tasks', { params: { page, limit } }),
  getDutyRoster: (page = 1, limit = 50) => API.get('/admin/duty-roster', { params: { page, limit } }),
  getAnnouncements: (page = 1, limit = 25) => API.get('/admin/announcements', { params: { page, limit } }),
  getClassrooms: () => API.get('/admin/classrooms'),
};

export const teacherAPI = {
  getDashboard: () => API.get('/teacher/dashboard'),
  getMyClass: () => API.get('/teacher/my-class'),
  getTasks: () => API.get('/teacher/tasks'),
  updateTask: (id, status) => API.put(`/teacher/tasks/${id}`, { status }),
  logAttendance: (attendance, date) => API.post('/teacher/attendance', { attendance, date }),
  postStudentNote: (data) => API.post('/teacher/student-notes', data),
  postDailyRoutine: (data) => API.post('/teacher/daily-routine', data),
  getAnnouncements: (page = 1, limit = 25) => API.get('/common/announcements', { params: { page, limit } }),
};

export const parentAPI = {
  getDashboard: () => API.get('/parent/dashboard'),
  getMyChild: () => API.get('/parent/my-child'),
  getDailyUpdates: () => API.get('/parent/daily-updates'),
  getTeacherNotes: () => API.get('/parent/teacher-notes'),
  getMessages: () => API.get('/parent/messages'),
  getAnnouncements: (page = 1, limit = 25) => API.get('/common/announcements', { params: { page, limit } }),
};

export const messageAPI = {
  getMessages: (receiverId) => API.get('/messages', { params: { receiverId } }),
  sendMessage: (receiverId, content) => API.post('/messages', { receiverId, content }),
};

export const notificationAPI = {
  getNotifications: () => API.get('/notifications'),
  markAllRead: () => API.put('/notifications/mark-read'),
  markAsRead: (id) => API.put(`/notifications/${id}/read`),
};

export default API;
