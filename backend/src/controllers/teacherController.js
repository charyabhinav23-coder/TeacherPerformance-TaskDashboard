const prisma = require('../config/prisma');
const { logAudit } = require('../utils/audit');

// Helper to normalize dates to midnight UTC
const getMidnightDate = (dateVal) => {
  const d = dateVal ? new Date(dateVal) : new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
};

// @desc    Get Teacher Dashboard Stats
// @route   GET /api/teacher/dashboard
// @access  Private (Teacher)
const getTeacherDashboard = async (req, res, next) => {
  try {
    const teacher = req.user.teacher;

    if (!teacher) {
      res.status(404);
      throw new Error('Teacher profile details not found');
    }

    const classroomId = teacher.classroomId;

    // 1. Get class students count
    const studentCount = classroomId 
      ? await prisma.student.count({ where: { classroomId } })
      : 0;

    // 2. Pending Tasks
    const pendingTasksCount = await prisma.task.count({
      where: {
        assigneeId: teacher.id,
        status: { not: 'COMPLETED' }
      }
    });

    // 3. Today's Attendance Rate
    let todayAttendanceRate = 100;
    if (classroomId && studentCount > 0) {
      const midnightToday = getMidnightDate();
      const todayAttendances = await prisma.attendance.findMany({
        where: {
          date: midnightToday,
          student: { classroomId }
        }
      });

      const presents = todayAttendances.filter(a => a.status === 'PRESENT').length;
      todayAttendanceRate = todayAttendances.length > 0
        ? Math.round((presents / todayAttendances.length) * 100)
        : 100;
    }

    let assignedClassName = 'None';
    if (classroomId) {
      const classroom = await prisma.classroom.findUnique({ where: { id: classroomId } });
      if (classroom) assignedClassName = classroom.name;
    }

    res.status(200).json({
      success: true,
      message: 'Teacher dashboard stats fetched successfully',
      data: {
        studentCount,
        pendingTasksCount,
        todayAttendanceRate,
        assignedClass: assignedClassName
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get teacher's assigned class student list
// @route   GET /api/teacher/my-class
// @access  Private (Teacher)
const getMyClass = async (req, res, next) => {
  try {
    const teacher = req.user.teacher;
    if (!teacher || !teacher.classroomId) {
      return res.status(200).json({
        success: true,
        message: 'No classroom assigned',
        data: []
      });
    }

    const students = await prisma.student.findMany({
      where: { classroomId: teacher.classroomId },
      include: {
        classroom: true,
        parent: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                phone: true
              }
            }
          }
        }
      }
    });

    res.status(200).json({
      success: true,
      message: 'Classroom students fetched successfully',
      data: students
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Log attendance for students
// @route   POST /api/teacher/attendance
// @access  Private (Teacher)
const logAttendance = async (req, res, next) => {
  try {
    const { attendance } = req.body; // Expects array: [{ studentId, status: "PRESENT" | "ABSENT" }]
    const dateParam = req.body.date; // Optional: "YYYY-MM-DD"
    
    if (!attendance || !Array.isArray(attendance)) {
      res.status(400);
      throw new Error('Attendance array is required');
    }

    const targetDate = getMidnightDate(dateParam);

    // Perform upsert for each student to prevent duplication on same date
    const results = [];
    for (const record of attendance) {
      const { studentId, status } = record;

      if (!studentId || !status) continue;

      const prismaStatus = status.toUpperCase() === 'PRESENT' ? 'PRESENT' : 'ABSENT';

      const upserted = await prisma.attendance.upsert({
        where: {
          studentId_date: {
            studentId,
            date: targetDate
          }
        },
        update: {
          status: prismaStatus
        },
        create: {
          studentId,
          date: targetDate,
          status: prismaStatus
        }
      });
      results.push(upserted);
    }

    logAudit({
      userId: req.user ? req.user.id : null,
      role: req.user ? req.user.role : null,
      action: 'LOG_ATTENDANCE',
      module: 'Teacher',
      recordId: req.user.id,
      ipAddress: req.ip
    });

    res.status(200).json({
      success: true,
      message: 'Attendance register synchronized successfully',
      data: results
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get teacher tasks
// @route   GET /api/teacher/tasks
// @access  Private (Teacher)
const getTeacherTasks = async (req, res, next) => {
  try {
    const teacher = req.user.teacher;
    if (!teacher) {
      res.status(404);
      throw new Error('Teacher record not found');
    }

    const tasks = await prisma.task.findMany({
      where: { assigneeId: teacher.id },
      orderBy: { dueDate: 'asc' }
    });

    res.status(200).json({
      success: true,
      message: 'Tasks fetched successfully',
      data: tasks
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update task status
// @route   PUT /api/teacher/tasks/:id
// @access  Private (Teacher)
const updateTask = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body; // TODO, IN_PROGRESS, REVIEW, COMPLETED

    const task = await prisma.task.findUnique({
      where: { id }
    });

    if (!task) {
      res.status(404);
      throw new Error('Task not found');
    }

    const updatedTask = await prisma.task.update({
      where: { id },
      data: {
        status: status.toUpperCase()
      }
    });

    // Check if task status updated to COMPLETED. If so, update teacher tasks completed counter.
    if (status.toUpperCase() === 'COMPLETED' && task.status !== 'COMPLETED' && task.assigneeId) {
      await prisma.teacher.update({
        where: { id: task.assigneeId },
        data: { tasksCompleted: { increment: 1 } }
      });
    }

    logAudit({
      userId: req.user ? req.user.id : null,
      role: req.user ? req.user.role : null,
      action: 'UPDATE_TASK',
      module: 'Teacher',
      recordId: updatedTask.id,
      ipAddress: req.ip
    });

    res.status(200).json({
      success: true,
      message: 'Task updated successfully',
      data: updatedTask
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Post student observation / note
// @route   POST /api/teacher/student-notes
// @access  Private (Teacher)
const postStudentNote = async (req, res, next) => {
  try {
    const { studentId, content, mood, milestones } = req.body;

    if (!studentId || !content) {
      res.status(400);
      throw new Error('Student ID and content note are required');
    }

    const student = await prisma.student.findUnique({
      where: { id: studentId }
    });

    if (!student) {
      res.status(404);
      throw new Error('Student not found');
    }

    // Prepare note object
    const newNote = {
      id: Math.random().toString(36).substr(2, 9),
      date: new Date().toISOString().split('T')[0],
      author: req.user.name,
      content,
      mood: mood || 'Happy'
    };

    // Parse existing notes and append
    const currentNotes = Array.isArray(student.notes) ? student.notes : [];
    const updatedNotes = [newNote, ...currentNotes];

    // Optional milestone update
    let updatedMilestones = student.milestones;
    if (milestones) {
      updatedMilestones = milestones; // Expected format: [{ name, progress }]
    }

    const updatedStudent = await prisma.student.update({
      where: { id: studentId },
      data: {
        notes: updatedNotes,
        mood: mood || student.mood,
        milestones: updatedMilestones
      }
    });

    logAudit({
      userId: req.user ? req.user.id : null,
      role: req.user ? req.user.role : null,
      action: 'UPDATE_STUDENT_NOTE',
      module: 'Teacher',
      recordId: updatedStudent.id,
      ipAddress: req.ip
    });

    res.status(200).json({
      success: true,
      message: 'Student note/observation added successfully',
      data: {
        note: newNote,
        student: {
          id: updatedStudent.id,
          name: updatedStudent.name,
          notes: updatedStudent.notes,
          milestones: updatedStudent.milestones
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Post daily routine updates (food, water, nap, potty)
// @route   POST /api/teacher/daily-routine
// @access  Private (Teacher)
const postDailyRoutine = async (req, res, next) => {
  try {
    const { studentId, breakfast, lunch, snacks, waterCups, napTime, pottyCheck, activityNotes } = req.body;

    if (!studentId || !breakfast || !lunch || !snacks || waterCups === undefined || !napTime) {
      res.status(400);
      throw new Error('StudentId, meals, water and nap details are required');
    }

    // Load student WITH parent to get parent.userId for notification
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: {
        parent: {
          include: { user: { select: { id: true, name: true } } }
        }
      }
    });

    if (!student) {
      res.status(404);
      throw new Error('Student not found');
    }

    // Security: ensure the student belongs to the requesting teacher's classroom
    const teacher = req.user.teacher;
    if (teacher && teacher.classroomId && student.classroomId !== teacher.classroomId) {
      res.status(403);
      throw new Error('You do not have permission to update this student\'s routine');
    }

    // Save DailyRoutine record to PostgreSQL
    const routine = await prisma.dailyRoutine.create({
      data: {
        studentId,
        breakfast,
        lunch,
        snacks,
        waterCups: parseInt(waterCups),
        napTime,
        pottyCheck: !!pottyCheck,
        activityNotes
      }
    });

    // Update student timeline with an event for this daily report submission
    const currentTimeline = Array.isArray(student.timeline) ? student.timeline : [];
    const newTimelineEvent = {
      time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      event: 'Daily Report Saved',
      desc: `Meals & Nap routine recorded by teacher ${req.user.name}.`
    };

    await prisma.student.update({
      where: { id: studentId },
      data: {
        timeline: [newTimelineEvent, ...currentTimeline]
      }
    });

    // Create a Notification for the parent in PostgreSQL
    if (student.parent && student.parent.user) {
      await prisma.notification.create({
        data: {
          title: 'Daily Routine Updated',
          content: `${student.name}'s daily routine has been updated by ${req.user.name}.`,
          type: 'DAILY_ROUTINE',
          isRead: false,
          userId: student.parent.user.id
        }
      });
    }

    logAudit({
      userId: req.user ? req.user.id : null,
      role: req.user ? req.user.role : null,
      action: 'CREATE_DAILY_ROUTINE',
      module: 'Teacher',
      recordId: routine.id,
      ipAddress: req.ip
    });

    res.status(201).json({
      success: true,
      message: 'Daily routine report saved successfully. Parent has been notified.',
      data: routine
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getTeacherDashboard,
  getMyClass,
  logAttendance,
  getTeacherTasks,
  updateTask,
  postStudentNote,
  postDailyRoutine
};
