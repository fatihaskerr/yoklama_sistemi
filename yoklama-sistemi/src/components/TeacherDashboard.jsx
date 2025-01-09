import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  Container,
  Typography,
  Box,
  Button,
  Grid,
  Card,
  CardContent,
  CardActions,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemText,
  Divider,
  AppBar,
  Toolbar,
  Alert,
  Paper,
  IconButton,
  ListItemIcon,
} from '@mui/material';
import LogoutIcon from '@mui/icons-material/Logout';
import PersonIcon from '@mui/icons-material/Person';
import TimerIcon from '@mui/icons-material/Timer';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import EventIcon from '@mui/icons-material/Event';

function TeacherDashboard() {
  const navigate = useNavigate();
  const [courses, setCourses] = useState([]);
  const [openAttendanceDialog, setOpenAttendanceDialog] = useState(false);
  const [openAttendanceListDialog, setOpenAttendanceListDialog] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [attendanceCode, setAttendanceCode] = useState('');
  const [attendanceList, setAttendanceList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [openStudentDialog, setOpenStudentDialog] = useState(false);
  const [selectedCourseForStudents, setSelectedCourseForStudents] = useState(null);
  const [studentEmails, setStudentEmails] = useState('');

  useEffect(() => {
    fetchCourses();
  }, []);

  const fetchCourses = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('http://localhost:8000/courses', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setCourses(response.data);
    } catch (error) {
      console.error('Dersler yüklenirken hata:', error);
      setError('Dersler yüklenirken bir hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  const handleStartAttendance = async (course) => {
    try {
      console.log("Starting attendance for course:", course);  // Debug log
      setSelectedCourse(course);
      const token = localStorage.getItem('token');
      console.log("Using token:", token);  // Debug log
      
      const response = await axios.post(
        'http://localhost:8000/attendance/start',
        { course_id: course._id },
        { 
          headers: { 
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          } 
        }
      );
      
      console.log("Attendance response:", response.data);  // Debug log
      setAttendanceCode(response.data.code);
      setOpenAttendanceDialog(true);
      setSuccess('Yoklama başarıyla başlatıldı');
      setError('');
      
      // Kursları güncelle
      const updatedCourses = courses.map(c => 
        c._id === course._id ? { ...c, has_active_attendance: true } : c
      );
      setCourses(updatedCourses);
    } catch (err) {
      console.error('Yoklama başlatılırken hata:', err);
      console.error('Hata detayı:', err.response?.data);  // Debug log
      let errorMessage = 'Yoklama başlatılırken bir hata oluştu';
      
      if (err.response?.data?.detail) {
        errorMessage = err.response.data.detail;
      } else if (typeof err.response?.data === 'string') {
        errorMessage = err.response.data;
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      setError(errorMessage);
      setSuccess('');
    }
  };

  const handleEndAttendance = async (course) => {
    try {
      console.log("Ending attendance for course:", course);  // Debug log
      const token = localStorage.getItem('token');
      console.log("Using token:", token);  // Debug log
      
      const response = await axios.post(
        'http://localhost:8000/attendance/end',
        { course_id: course._id },
        { 
          headers: { 
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          } 
        }
      );
      
      console.log("End attendance response:", response.data);  // Debug log
      setSuccess('Yoklama başarıyla sonlandırıldı');
      setError('');

      // Kursları güncelle
      const updatedCourses = courses.map(c => 
        c._id === course._id ? { ...c, has_active_attendance: false } : c
      );
      setCourses(updatedCourses);
      
      // Yoklama geçmişini al
      const historyResponse = await axios.get(
        `http://localhost:8000/attendance/history/${course._id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      console.log("History response:", historyResponse.data);  // Debug log
      setAttendanceList(historyResponse.data);
      setOpenAttendanceListDialog(true);
    } catch (err) {
      console.error('Yoklama bitirilirken hata:', err);
      console.error('Hata detayı:', err.response?.data);  // Debug log
      let errorMessage = 'Yoklama bitirilirken bir hata oluştu';
      
      if (err.response?.data?.detail) {
        errorMessage = err.response.data.detail;
      } else if (typeof err.response?.data === 'string') {
        errorMessage = err.response.data;
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      setError(errorMessage);
      setSuccess('');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('userEmail');
    navigate('/');
  };

  const handleAddStudents = async (course) => {
    setSelectedCourseForStudents(course);
    setOpenStudentDialog(true);
  };

  const handleSubmitStudents = async () => {
    if (!studentEmails.trim()) {
      setError('Lütfen en az bir öğrenci e-postası girin');
      return;
    }

    try {
      const emails = studentEmails.split(',').map(email => email.trim()).filter(email => email);
      if (emails.length === 0) {
        setError('Lütfen geçerli e-posta adresleri girin');
        return;
      }

      const token = localStorage.getItem('token');
      await axios.post(
        `http://localhost:8000/courses/${selectedCourseForStudents._id}/students`,
        { student_emails: emails },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      // Önce success mesajını göster ve dialog'u kapat
      setSuccess('Öğrenciler başarıyla eklendi');
      setError('');
      setOpenStudentDialog(false);
      setStudentEmails('');

      // Sonra dersleri yenile
      await fetchCourses();
    } catch (err) {
      console.error('Öğrenci ekleme hatası:', err);
      setError(err.response?.data?.detail || 'Öğrenciler eklenirken bir hata oluştu');
      setSuccess('');
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Typography>Yükleniyor...</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: '100vh', backgroundColor: '#f5f5f5' }}>
      <AppBar position="static" sx={{ backgroundColor: '#1a237e' }}>
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1, display: 'flex', alignItems: 'center' }}>
            <TimerIcon sx={{ mr: 1 }} /> Yoklama Sistemi
          </Typography>
          <Button 
            color="inherit" 
            onClick={handleLogout} 
            startIcon={<LogoutIcon />}
            sx={{ '&:hover': { backgroundColor: '#0d47a1' } }}
          >
            Çıkış Yap
          </Button>
        </Toolbar>
      </AppBar>

      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        {error && (
          <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>
            {error}
          </Alert>
        )}
        
        {success && (
          <Alert severity="success" sx={{ mb: 3, borderRadius: 2 }}>
            {success}
          </Alert>
        )}

        <Paper elevation={0} sx={{ p: 3, mb: 3, borderRadius: 2, backgroundColor: '#fff' }}>
          <Typography variant="h5" gutterBottom sx={{ color: '#1a237e', display: 'flex', alignItems: 'center' }}>
            <PersonIcon sx={{ mr: 1 }} /> Öğretmen Paneli
          </Typography>
          <Typography color="textSecondary" sx={{ mb: 3 }}>
            Derslerinizi yönetin ve yoklama alın
          </Typography>

          {courses.length === 0 ? (
            <Alert severity="info" sx={{ borderRadius: 2 }}>
              Henüz ders bulunmuyor.
            </Alert>
          ) : (
            <Grid container spacing={3}>
              {courses.map((course) => (
                <Grid item xs={12} md={6} key={course._id}>
                  <Card sx={{ 
                    height: '100%', 
                    display: 'flex', 
                    flexDirection: 'column',
                    borderRadius: 2,
                    transition: 'transform 0.2s',
                    '&:hover': {
                      transform: 'translateY(-4px)',
                      boxShadow: 3
                    }
                  }}>
                    <CardContent sx={{ flexGrow: 1 }}>
                      <Typography variant="h5" gutterBottom sx={{ color: '#1a237e' }}>
                        {course.name}
                      </Typography>
                      <Typography color="textSecondary" gutterBottom>
                        Ders Kodu: {course.code}
                      </Typography>
                      <Typography color="textSecondary" gutterBottom>
                        Program: {course.schedule}
                      </Typography>
                      {course.has_active_attendance && (
                        <Chip
                          icon={<CheckCircleIcon />}
                          label="Yoklama Aktif"
                          color="success"
                          sx={{ mt: 1, borderRadius: '16px' }}
                        />
                      )}
                      {course.student_emails && (
                        <Box sx={{ mt: 2, backgroundColor: '#f5f5f5', borderRadius: 1, p: 1 }}>
                          <Typography color="textSecondary" gutterBottom>
                            Kayıtlı Öğrenciler ({course.student_emails.length})
                          </Typography>
                          <List dense sx={{ maxHeight: 150, overflow: 'auto' }}>
                            {course.student_emails.map((email, index) => (
                              <ListItem key={index} sx={{ py: 0.5 }}>
                                <ListItemText
                                  primary={email}
                                  sx={{ 
                                    '& .MuiListItemText-primary': { 
                                      fontSize: '0.9rem',
                                      color: '#424242'
                                    } 
                                  }}
                                />
                              </ListItem>
                            ))}
                          </List>
                        </Box>
                      )}
                    </CardContent>
                    <CardActions sx={{ p: 2, pt: 0 }}>
                      {!course.has_active_attendance ? (
                        <Button
                          variant="contained"
                          color="primary"
                          onClick={() => handleStartAttendance(course)}
                          fullWidth
                          sx={{ 
                            borderRadius: '8px',
                            backgroundColor: '#1a237e',
                            '&:hover': { backgroundColor: '#0d47a1' }
                          }}
                        >
                          Yoklama Başlat
                        </Button>
                      ) : (
                        <Button
                          variant="contained"
                          color="error"
                          onClick={() => handleEndAttendance(course)}
                          fullWidth
                          sx={{ 
                            borderRadius: '8px',
                            '&:hover': { backgroundColor: '#d32f2f' }
                          }}
                        >
                          Yoklamayı Bitir
                        </Button>
                      )}
                    </CardActions>
                  </Card>
                </Grid>
              ))}
            </Grid>
          )}
        </Paper>

        {/* Yoklama Kodu Dialog */}
        <Dialog 
          open={openAttendanceDialog} 
          onClose={() => setOpenAttendanceDialog(false)}
          PaperProps={{
            sx: { borderRadius: 2 }
          }}
        >
          <DialogTitle sx={{ backgroundColor: '#1a237e', color: 'white' }}>
            Yoklama Kodu
          </DialogTitle>
          <DialogContent sx={{ mt: 2 }}>
            <Typography variant="h3" align="center" gutterBottom sx={{ 
              color: '#1a237e',
              letterSpacing: 3,
              fontWeight: 'bold'
            }}>
              {attendanceCode}
            </Typography>
            <Typography color="textSecondary">
              Bu kodu öğrencilerle paylaşın. Öğrenciler bu kod ile yoklamaya katılabilecek.
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button 
              onClick={() => setOpenAttendanceDialog(false)}
              sx={{ color: '#1a237e' }}
            >
              Kapat
            </Button>
          </DialogActions>
        </Dialog>

        {/* Yoklama Listesi Dialog */}
        <Dialog 
          open={openAttendanceListDialog} 
          onClose={() => setOpenAttendanceListDialog(false)}
          maxWidth="sm"
          fullWidth
          PaperProps={{
            sx: { borderRadius: 2 }
          }}
        >
          <DialogTitle sx={{ backgroundColor: '#1a237e', color: 'white', display: 'flex', alignItems: 'center' }}>
            <TimerIcon sx={{ mr: 1 }} /> Yoklama Geçmişi
          </DialogTitle>
          <DialogContent>
            <List sx={{ mt: 2 }}>
              {attendanceList.length > 0 ? (
                attendanceList.map((record, recordIndex) => (
                  <React.Fragment key={recordIndex}>
                    <Paper elevation={1} sx={{ p: 2, mb: recordIndex < attendanceList.length - 1 ? 2 : 0 }}>
                      <Typography variant="subtitle1" sx={{ 
                        mb: 2, 
                        color: '#1a237e', 
                        fontWeight: 500,
                        display: 'flex',
                        alignItems: 'center'
                      }}>
                        <EventIcon sx={{ mr: 1, fontSize: 20 }} />
                        {record.date}
                      </Typography>
                      {record.students && record.students.length > 0 ? (
                        <List disablePadding>
                          {record.students.map((student, studentIndex) => (
                            <ListItem key={`${recordIndex}-${studentIndex}`} disablePadding sx={{ mb: 1 }}>
                              <ListItemIcon>
                                <PersonIcon sx={{ color: '#1a237e' }} />
                              </ListItemIcon>
                              <ListItemText 
                                primary={student.full_name}
                                secondary={student.email}
                                primaryTypographyProps={{
                                  sx: { color: '#1a237e', fontWeight: 500 }
                                }}
                                secondaryTypographyProps={{
                                  sx: { color: 'text.secondary' }
                                }}
                              />
                            </ListItem>
                          ))}
                        </List>
                      ) : (
                        <Typography color="text.secondary" align="center" sx={{ py: 1 }}>
                          Bu yoklamada katılan öğrenci yok.
                        </Typography>
                      )}
                    </Paper>
                  </React.Fragment>
                ))
              ) : (
                <Typography color="text.secondary" align="center" sx={{ py: 3 }}>
                  Henüz yoklama kaydı yok.
                </Typography>
              )}
            </List>
          </DialogContent>
          <DialogActions>
            <Button 
              onClick={() => setOpenAttendanceListDialog(false)}
              sx={{ color: '#1a237e' }}
            >
              Kapat
            </Button>
          </DialogActions>
        </Dialog>
      </Container>
    </Box>
  );
}

export default TeacherDashboard; 