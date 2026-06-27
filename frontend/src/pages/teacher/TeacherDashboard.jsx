/* src/pages/teacher/TeacherDashboard.jsx */
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useNotifications } from '../../context/NotificationContext';
import { Users, CheckCircle2, Clock, FileText, ArrowRight, AlertCircle } from 'lucide-react';
import GlassCard from '../../components/GlassCard';
import CountUp from '../../components/CountUp';
import { mockChildren as mockChildrenImported } from '../../data/mockData';
import { teacherAPI, authAPI } from '../../services/api';
import '../../styles/pages.css';

const TeacherDashboard = () => {
  const navigate = useNavigate();
  const { success } = useNotifications();
  
  // API Integration States
  const [isLoading, setIsLoading] = useState(true);
  const [errorState, setErrorState] = useState(null);
  const [stats, setStats] = useState({
    studentCount: 12,
    pendingTasksCount: 3,
    todayAttendanceRate: 92,
    assignedClass: 'Playgroup A'
  });
  const [children, setChildren] = useState([]);
  const [teacherProfile, setTeacherProfile] = useState({ teacherRegNo: '', employeeId: '' });
  
  const mockChildren = children.length > 0 ? children : mockChildrenImported;

  const [checklist, setChecklist] = useState([
    { id: 1, text: 'Perform morning safety check', done: true },
    { id: 2, text: 'Sanitize class tables and toys', done: true },
    { id: 3, text: 'Submit Breakfast logs for all kids', done: false },
    { id: 4, text: 'Plan afternoon outdoor block game', done: false },
    { id: 5, text: 'Conduct sensory storytime session', done: false }
  ]);

  const [studentAttendance, setStudentAttendance] = useState(
    mockChildren.reduce((acc, c) => {
      acc[c.id] = 'present';
      return acc;
      // Note: we can initialize with local storage or fetch from DB if needed
    }, {})
  );

  const fetchDashboardData = async () => {
    setIsLoading(true);
    setErrorState(null);
    try {
      const resStats = await teacherAPI.getDashboard();
      if (resStats.data && resStats.data.success) {
        setStats(resStats.data.data);
      }
      const resClass = await teacherAPI.getMyClass();
      if (resClass.data && resClass.data.success) {
        const mapped = resClass.data.data.map(s => ({
          id: s.id,
          name: s.name,
          avatar: s.avatar || s.name.split(' ').map(p => p[0]).join('').toUpperCase().slice(0, 2),
          age: s.age
        }));
        setChildren(mapped);
        // Extract teacher profile from first student's teacher info or from auth/me
        try {
          const resMe = await authAPI.getMe();
          if (resMe.data && resMe.data.success && resMe.data.data.user && resMe.data.data.user.teacher) {
            setTeacherProfile({
              teacherRegNo: resMe.data.data.user.teacher.teacherRegNo || '',
              employeeId: resMe.data.data.user.teacher.employeeId || ''
            });
          }
        } catch (e) {
          // Try reading from activeUser in localStorage as fallback
          const au = localStorage.getItem('activeUser');
          if (au) {
            const activeUser = JSON.parse(au);
            setTeacherProfile({
              teacherRegNo: activeUser.teacherRegNo || '',
              employeeId: activeUser.employeeId || ''
            });
          }
        }
      }
    } catch (err) {
      if (import.meta.env.VITE_USE_MOCK_DATA === 'true') {
        console.warn("Using mock fallback", err);
        // Try reading from activeUser in localStorage as fallback
        const au = localStorage.getItem('activeUser');
        if (au) {
          const activeUser = JSON.parse(au);
          setTeacherProfile({
            teacherRegNo: activeUser.teacherRegNo || '',
            employeeId: activeUser.employeeId || ''
          });
        }
      } else {
        setErrorState('Unable to connect to the server. Please try again later or contact your system administrator.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();

    const interval = setInterval(fetchDashboardData, 15000);
    return () => clearInterval(interval);
  }, []);

  const handleChecklistToggle = (id) => {
    setChecklist(prev => prev.map(item => {
      if (item.id === id) {
        const nextState = !item.done;
        if (nextState) success('Task Completed', item.text);
        return { ...item, done: nextState };
      }
      return item;
    }));
  };

  const handleStudentAttendance = async (kidId, status) => {
    try {
      await teacherAPI.logAttendance([{ studentId: kidId, status: status.toUpperCase() }]);
      setStudentAttendance(prev => ({ ...prev, [kidId]: status }));
      const kid = mockChildren.find(c => c.id === kidId);
      success('Attendance Updated', `${kid.name} marked as ${status.toUpperCase()} today.`);
      
      // Refresh KPIs to update todayAttendanceRate
      const resStats = await teacherAPI.getDashboard();
      if (resStats.data && resStats.data.success) {
        setStats(resStats.data.data);
      }
    } catch (err) {
      console.warn("Failed to log attendance via API. Falling back to local state.", err);
      setStudentAttendance(prev => ({ ...prev, [kidId]: status }));
      const kid = mockChildren.find(c => c.id === kidId);
      success('Attendance Updated (Offline)', `${kid.name} marked as ${status.toUpperCase()} today.`);
    }
  };

  const widgets = [
    { title: 'Class Size', value: stats.studentCount, label: stats.assignedClass || 'My Classroom', icon: Users, color: 'var(--primary)' },
    { title: 'Attendance Rate', value: stats.todayAttendanceRate, label: 'Today', icon: CheckCircle2, color: 'var(--success)' },
    { title: 'Active Tasks', value: stats.pendingTasksCount, label: 'Pending Tasks', icon: Clock, color: 'var(--warning)' },
    { title: 'Pending Logs', value: 2, label: 'Logs due by 4 PM', icon: FileText, color: 'var(--accent)' }
  ];

  if (isLoading) {
    return (
      <div className="page-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <div style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
          <div className="spinner" style={{ border: '4px solid rgba(255,255,255,0.1)', borderTop: '4px solid var(--primary)', borderRadius: '50%', width: '40px', height: '40px', animation: 'spin 1s linear infinite', margin: '0 auto 15px' }}></div>
          <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  if (errorState) {
    return (
      <div className="page-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <GlassCard style={{ textAlign: 'center', padding: '40px', maxWidth: '500px' }}>
          <AlertCircle size={48} color="var(--danger)" style={{ marginBottom: '15px' }} />
          <h3 style={{ color: 'var(--text-primary)', marginBottom: '10px' }}>Connection Error</h3>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '20px', lineHeight: '1.5' }}>{errorState}</p>
          <button className="primary-btn" onClick={() => window.location.reload()} style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
            Try Again
          </button>
        </GlassCard>
      </div>
    );
  }

  return (
    <div className="page-container">
      {/* KPI Grid */}
      <div className="kpi-grid">
        {widgets.map((wd, index) => {
          const Icon = wd.icon;
          return (
            <GlassCard key={index} delay={index * 0.1} className="kpi-card">
              <div className="kpi-details">
                <h3>{wd.title}</h3>
                <div className="kpi-value">
                  <CountUp value={wd.value} />
                </div>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', fontWeight: 500 }}>
                  {wd.label}
                </span>
              </div>
              <div className="kpi-icon-wrapper" style={{ color: wd.color, background: `${wd.color}15` }}>
                <Icon size={24} />
              </div>
            </GlassCard>
          );
        })}
      </div>

      {/* Teacher ID Info Strip */}
      {(teacherProfile.teacherRegNo || teacherProfile.employeeId) && (
        <div style={{
          display: 'flex',
          gap: '16px',
          flexWrap: 'wrap',
          padding: '10px 16px',
          borderRadius: '10px',
          background: 'rgba(139,92,246,0.07)',
          border: '1px solid rgba(139,92,246,0.18)',
          fontSize: '0.82rem',
          marginBottom: '4px'
        }}>
          {teacherProfile.teacherRegNo && (
            <span style={{ color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              Registration No: <strong style={{ color: 'var(--primary)' }}>{teacherProfile.teacherRegNo}</strong>
              <button 
                onClick={() => { navigator.clipboard.writeText(teacherProfile.teacherRegNo); success('Copied successfully'); }} 
                style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: '0.8rem', padding: 0 }}
                title="Copy Registration Number"
              >
                📋
              </button>
            </span>
          )}
          {teacherProfile.teacherRegNo && teacherProfile.employeeId && (
            <span style={{ color: 'var(--divider)' }}>|</span>
          )}
          {teacherProfile.employeeId && (
            <span style={{ color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              Employee ID: <strong style={{ color: 'var(--primary)' }}>{teacherProfile.employeeId}</strong>
              <button 
                onClick={() => { navigator.clipboard.writeText(teacherProfile.employeeId); success('Copied successfully'); }} 
                style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: '0.8rem', padding: 0 }}
                title="Copy Employee ID"
              >
                📋
              </button>
            </span>
          )}
        </div>
      )}

      <div className="routine-grid">
        {/* Left Side: Class Roster list */}
        <GlassCard delay={0.2}>
          <div className="chart-card-title" style={{ borderBottom: '1px solid var(--divider)', paddingBottom: '10px', marginBottom: '15px' }}>
            <span>My Class Roster (Playgroup A)</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            {mockChildren.map((kid) => (
              <div 
                key={kid.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px',
                  borderRadius: '12px',
                  border: '1px solid var(--card-border)',
                  background: 'rgba(255,255,255,0.06)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div className="profile-avatar" style={{ width: '36px', height: '36px', fontSize: '0.9rem' }}>
                    {kid.avatar}
                  </div>
                  <div>
                    <h4 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>{kid.name}</h4>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>{kid.age}</p>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    onClick={() => handleStudentAttendance(kid.id, 'present')}
                    style={{
                      padding: '4px 8px',
                      borderRadius: '6px',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      background: studentAttendance[kid.id] === 'present' ? 'var(--success)' : 'rgba(0,0,0,0.05)',
                      color: studentAttendance[kid.id] === 'present' ? 'white' : 'var(--text-secondary)'
                    }}
                  >
                    Present
                  </button>
                  <button
                    onClick={() => handleStudentAttendance(kid.id, 'absent')}
                    style={{
                      padding: '4px 8px',
                      borderRadius: '6px',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      background: studentAttendance[kid.id] === 'absent' ? 'var(--danger)' : 'rgba(0,0,0,0.05)',
                      color: studentAttendance[kid.id] === 'absent' ? 'white' : 'var(--text-secondary)'
                    }}
                  >
                    Absent
                  </button>
                </div>
              </div>
            ))}
          </div>
        </GlassCard>

        {/* Right Side: Checklist & quick link */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <GlassCard delay={0.3}>
            <div className="chart-card-title">
              <span>Morning Checklists</span>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '10px' }}>
              {checklist.map((item) => (
                <label 
                  key={item.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    fontSize: '0.85rem',
                    color: item.done ? 'var(--text-tertiary)' : 'var(--text-secondary)',
                    textDecoration: item.done ? 'line-through' : 'none',
                    cursor: 'pointer',
                    padding: '8px',
                    borderRadius: '8px',
                    background: item.done ? 'rgba(0,0,0,0.02)' : 'rgba(255,255,255,0.08)',
                    transition: 'all var(--transition-fast)'
                  }}
                >
                  <input
                    type="checkbox"
                    checked={item.done}
                    onChange={() => handleChecklistToggle(item.id)}
                    style={{ width: '18px', height: '18px', accentColor: 'var(--primary)', cursor: 'pointer' }}
                  />
                  <span>{item.text}</span>
                </label>
              ))}
            </div>
          </GlassCard>

          <GlassCard delay={0.4}>
            <div className="chart-card-title">
              <span>Quick Tasks & logs</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button 
                onClick={() => navigate('/teacher/routinelog')}
                className="btn-premium"
                style={{ width: '100%', fontSize: '0.85rem', display: 'flex', justifyContent: 'center', gap: '6px' }}
              >
                Enter Daily Routine logs <ArrowRight size={16} />
              </button>
              <button 
                onClick={() => navigate('/teacher/tasks')}
                className="btn-glass"
                style={{ width: '100%', fontSize: '0.85rem', display: 'flex', justifyContent: 'center', gap: '6px' }}
              >
                View My Assigned Tasks <ArrowRight size={16} />
              </button>
            </div>
          </GlassCard>
        </div>
      </div>
    </div>
  );
};

export default TeacherDashboard;
