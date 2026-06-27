/* src/pages/admin/Announcements.jsx */
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNotifications } from '../../context/NotificationContext';
import { Megaphone, Plus, Calendar, User, Trash2, X, AlertCircle, RefreshCw, Clock } from 'lucide-react';
import GlassCard from '../../components/GlassCard';
import { mockAnnouncements } from '../../data/mockData';
import { adminAPI, teacherAPI, parentAPI } from '../../services/api';
import '../../styles/pages.css';

const Announcements = () => {
  const { success, warning } = useNotifications();
  const [announcements, setAnnouncements] = useState([]);
  const [filterPriority, setFilterPriority] = useState('all');
  const [isLoading, setIsLoading] = useState(true);
  const [errorState, setErrorState] = useState(null);

  const loadData = async () => {
    setIsLoading(true);
    setErrorState(null);
    try {
      const role = localStorage.getItem('activeRole') || 'parent';
      let response;
      if (role === 'admin') {
        response = await adminAPI.getAnnouncements(1, 100);
      } else if (role === 'teacher') {
        response = await teacherAPI.getAnnouncements(1, 100);
      } else {
        response = await parentAPI.getAnnouncements(1, 100);
      }
      setAnnouncements(response.data?.data || []);
    } catch (err) {
      console.error('Failed to load announcements:', err);
      if (import.meta.env.VITE_USE_MOCK_DATA === 'true') {
        console.warn('Using mock fallback for announcements');
        setAnnouncements(mockAnnouncements);
      } else {
        setErrorState('Unable to connect to the server. Please try again later or contact your system administrator.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [priority, setPriority] = useState('medium');
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduledDate, setScheduledDate] = useState(new Date(Date.now() + 86400000).toISOString().split('T')[0]);

  // Read role to enforce read-only modes
  const activeRole = localStorage.getItem('activeRole') || 'parent';
  const isAdmin = activeRole === 'admin';

  const handleCreateNotice = (e) => {
    e.preventDefault();
    if (!isAdmin) return;

    if (!title || !content) {
      warning('Validation Error', 'Title and description cannot be empty.');
      return;
    }

    const newNotice = {
      id: `ann-${Date.now()}`,
      title: title,
      content: content,
      priority: priority,
      createdByName: 'Admin',
      date: new Date().toISOString().split('T')[0],
      scheduledTime: isScheduled ? `Scheduled for ${scheduledDate}` : 'Immediate',
      createdAt: new Date().toISOString()
    };

    setAnnouncements(prev => [newNotice, ...prev]);
    setIsModalOpen(false);
    success('Notice Published', `Announcement "${title}" has been shared.`);

    setTitle('');
    setContent('');
    setPriority('medium');
    setIsScheduled(false);
  };

  const handleDeleteNotice = (id) => {
    if (!isAdmin) return;
    const notice = announcements.find(n => n.id === id);
    setAnnouncements(prev => prev.filter(n => n.id !== id));
    warning('Notice Deleted', `Removed announcement "${notice?.title || 'Unknown'}".`);
  };

  const filteredNotices = announcements.filter((notice) => {
    if (filterPriority === 'all') return true;
    return notice.priority === filterPriority;
  });

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
          <button className="primary-btn" onClick={loadData} style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
            <RefreshCw size={18} />
            Try Again
          </button>
        </GlassCard>
      </div>
    );
  }

  return (
    <div className="page-container">
      <style>{`
        .modal-overlay-dark {
          position: fixed;
          top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(0, 0, 0, 0.6);
          backdrop-filter: blur(8px);
          z-index: 1000;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .announcement-modal {
          background: rgba(18, 12, 35, 0.96);
          backdrop-filter: blur(24px);
          border: 1px solid rgba(255,255,255,0.12);
          box-shadow: 0 24px 70px rgba(0,0,0,0.45);
          width: 600px;
          max-width: 92vw;
          max-height: 85vh;
          overflow-y: auto;
          border-radius: 20px;
          padding: 30px;
        }
        .announcement-modal::-webkit-scrollbar {
          width: 8px;
        }
        .announcement-modal::-webkit-scrollbar-track {
          background: rgba(0,0,0,0.1);
        }
        .announcement-modal::-webkit-scrollbar-thumb {
          background: rgba(255,255,255,0.2);
          border-radius: 4px;
        }
        .announcement-modal .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 24px;
          padding-bottom: 15px;
          border-bottom: 1px solid rgba(255,255,255,0.05);
        }
        .announcement-modal .modal-header h3 {
          font-size: 1.3rem;
          color: var(--text-primary);
          margin: 0;
        }
        .announcement-form-group {
          display: flex;
          flex-direction: column;
          gap: 8px;
          margin-bottom: 18px;
        }
        .announcement-form-group label {
          color: var(--text-secondary);
          font-size: 0.9rem;
          font-weight: 500;
        }
        .announcement-input {
          width: 100%;
          height: 48px;
          padding: 14px 16px;
          border: 1px solid rgba(255,255,255,0.15);
          background: rgba(0,0,0,0.3);
          border-radius: 12px;
          color: var(--text-primary);
          font-size: 0.95rem;
          transition: all 0.2s ease;
        }
        .announcement-input:focus {
          outline: none;
          border-color: var(--primary);
          background: rgba(0,0,0,0.4);
        }
        textarea.announcement-input {
          height: auto;
          min-height: 120px;
          resize: vertical;
        }
        .checkbox-row {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 18px;
        }
        .modal-actions {
          display: flex;
          gap: 12px;
          margin-top: 30px;
        }
        .modal-actions button {
          flex: 1;
          height: 48px;
          font-size: 1rem;
        }
        .announcement-actions {
          display: flex;
          align-items: center;
          gap: 14px;
          flex-wrap: wrap;
        }
        .create-notice-btn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          height: 48px;
          padding: 0 18px;
          border-radius: 14px;
          border: none;
          background: linear-gradient(135deg, var(--primary), var(--secondary));
          color: white;
          font-weight: 700;
          box-shadow: 0 12px 30px rgba(168, 85, 247, 0.28);
          cursor: pointer;
          transition: all var(--transition-fast);
        }
        .create-notice-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 16px 36px rgba(168, 85, 247, 0.38);
        }
      `}</style>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-xl)', flexWrap: 'wrap', gap: '15px' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '5px' }}>Notice Board</h2>
          <p style={{ color: 'var(--text-secondary)' }}>Broadcast announcements to staff and parents</p>
        </div>

        <div className="announcement-actions">
          <div className="login-tabs" style={{ marginBottom: 0 }}>
            {['all', 'high', 'medium', 'low'].map((mode) => (
              <button
                key={mode}
                className={`login-tab-btn ${filterPriority === mode ? 'active' : ''}`}
                onClick={() => setFilterPriority(mode)}
                style={{ padding: '8px 15px' }}
              >
                {mode.toUpperCase()}
              </button>
            ))}
          </div>

          {isAdmin && (
            <button className="create-notice-btn" onClick={() => setIsModalOpen(true)}>
              <Plus size={18} />
              Create Notice
            </button>
          )}
        </div>
      </div>

      {filteredNotices.length === 0 ? (
        <GlassCard style={{ textAlign: 'center', padding: '60px' }}>
          <Megaphone size={48} color="var(--text-tertiary)" style={{ margin: '0 auto 15px', display: 'block' }} />
          <h3 style={{ color: 'var(--text-primary)', marginBottom: '10px' }}>No Announcements Found</h3>
          <p style={{ color: 'var(--text-secondary)' }}>There are no notices matching the selected filter.</p>
        </GlassCard>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <AnimatePresence>
            {filteredNotices.map((notice) => (
              <motion.div
                layout
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
                key={notice.id}
              >
                <GlassCard style={{ padding: '25px', position: 'relative', overflow: 'hidden' }}>
                  {notice.priority === 'high' && (
                    <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '4px', background: 'var(--danger)' }} />
                  )}
                  {notice.priority === 'medium' && (
                    <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '4px', background: 'var(--warning)' }} />
                  )}
                  {notice.priority === 'low' && (
                    <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '4px', background: 'var(--success)' }} />
                  )}

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '15px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                      <div className="icon-wrapper" style={{ 
                        background: notice.priority === 'high' ? 'rgba(239, 68, 68, 0.1)' : notice.priority === 'medium' ? 'rgba(245, 158, 11, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                        color: notice.priority === 'high' ? 'var(--danger)' : notice.priority === 'medium' ? 'var(--warning)' : 'var(--success)',
                        padding: '12px',
                        borderRadius: '12px'
                      }}>
                        <Megaphone size={24} />
                      </div>
                      <div>
                        <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>
                          {notice.title}
                        </h3>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '15px', fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Calendar size={12} /> {new Date(notice.date).toLocaleDateString()}</span>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Clock size={12} /> {notice.scheduledTime || 'Immediate'}</span>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><User size={12} /> {notice.createdByName || 'Admin'}</span>
                        </div>
                      </div>
                    </div>

                    {isAdmin && (
                      <button 
                        className="icon-btn-danger" 
                        style={{ padding: '6px', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)', border: 'none', borderRadius: '8px', cursor: 'pointer' }}
                        onClick={() => handleDeleteNotice(notice.id)}
                        title="Delete Notice"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>

                  <p style={{ color: 'var(--text-secondary)', lineHeight: '1.6', fontSize: '0.95rem' }}>
                    {notice.content}
                  </p>
                </GlassCard>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {isModalOpen && (
        <div className="modal-overlay-dark" onClick={() => setIsModalOpen(false)}>
          <div className="announcement-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Create New Announcement</h3>
              <button 
                className="icon-btn" 
                onClick={() => setIsModalOpen(false)}
                style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '50%', padding: '6px', cursor: 'pointer', color: 'var(--text-primary)' }}
              >
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleCreateNotice}>
              <div className="announcement-form-group">
                <label>Notice Title</label>
                <input 
                  type="text" 
                  value={title} 
                  onChange={(e) => setTitle(e.target.value)} 
                  placeholder="E.g., Upcoming Holiday Schedule"
                  className="announcement-input" 
                />
              </div>
              
              <div className="announcement-form-group">
                <label>Message Content</label>
                <textarea 
                  value={content} 
                  onChange={(e) => setContent(e.target.value)} 
                  placeholder="Enter the full announcement text here..."
                  className="announcement-input" 
                ></textarea>
              </div>

              <div className="announcement-form-group">
                <label>Priority Level</label>
                <select 
                  value={priority} 
                  onChange={(e) => setPriority(e.target.value)} 
                  className="announcement-input"
                >
                  <option value="low">Low - General Info</option>
                  <option value="medium">Medium - Important Update</option>
                  <option value="high">High - Urgent Action Required</option>
                </select>
              </div>

              <div className="checkbox-row">
                <input 
                  type="checkbox" 
                  id="scheduleNotice" 
                  checked={isScheduled} 
                  onChange={(e) => setIsScheduled(e.target.checked)} 
                  style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                />
                <label htmlFor="scheduleNotice" style={{ margin: 0, color: 'var(--text-secondary)', cursor: 'pointer' }}>Schedule for later</label>
              </div>

              {isScheduled && (
                <div className="announcement-form-group">
                  <label>Scheduled Date</label>
                  <input 
                    type="date" 
                    value={scheduledDate} 
                    onChange={(e) => setScheduledDate(e.target.value)} 
                    className="announcement-input" 
                  />
                </div>
              )}
              
              <div className="modal-actions">
                <button type="button" className="secondary-btn" onClick={() => setIsModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="primary-btn">
                  Publish Notice
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Announcements;
