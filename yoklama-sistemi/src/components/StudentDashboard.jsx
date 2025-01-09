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
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  AppBar,
  Toolbar,
  Alert,
  Paper,
} from '@mui/material';
import LogoutIcon from '@mui/icons-material/Logout';
import SchoolIcon from '@mui/icons-material/School';
import TimerIcon from '@mui/icons-material/Timer';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import EventAvailableIcon from '@mui/icons-material/EventAvailable';

function StudentDashboard() {
  const navigate = useNavigate();
  const [courses, setCourses] = useState([]);
  const [openDialog, setOpenDialog] = useState(false);
  const [attendanceCode, setAttendanceCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState('');

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
    } finally {
      setLoading(false);
    }
  };

  const handleAttendanceSubmit = async () => {
    if (!attendanceCode.trim()) return;

    try {
      const token = localStorage.getItem('token');
      const selectedCourse = courses.find(course => course.has_active_attendance);
      
      if (!selectedCourse) {
        setError('Aktif yoklama bulunamadı');
        return;
      }

      console.log("Submitting attendance for course:", selectedCourse);  // Debug log
      console.log("With code:", attendanceCode);  // Debug log

      await axios.post(
        'http://localhost:8000/attendance/submit', 
        { 
          course_id: selectedCourse._id,
          code: attendanceCode
        },
        { 
          headers: { 
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          } 
        }
      );
      
      setSuccess('Yoklamaya başarıyla katıldınız!');
      setError('');
      setAttendanceCode('');
      setOpenDialog(false);
      
      // Dersleri yenile
      await fetchCourses();
    } catch (err) {
      console.error('Yoklamaya katılırken hata:', err);
      console.error('Hata detayı:', err.response?.data);  // Debug log
      let errorMessage = 'Yoklamaya katılırken bir hata oluştu';
      
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

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Typography>Yükleniyor...</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: '100vh', backgroundColor: '#f5f5f5' }}>
      <AppBar position="static" sx={{ backgroundColor: '#2e7d32' }}>
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1, display: 'flex', alignItems: 'center' }}>
            <TimerIcon sx={{ mr: 1 }} /> Yoklama Sistemi
          </Typography>
          <Button
            variant="contained"
            color="success"
            onClick={() => setOpenDialog(true)}
            sx={{ mr: 2, backgroundColor: '#1b5e20', '&:hover': { backgroundColor: '#2e7d32' } }}
          >
            Yoklamaya Katıl
          </Button>
          <Button 
            color="inherit" 
            onClick={handleLogout} 
            startIcon={<LogoutIcon />}
            sx={{ '&:hover': { backgroundColor: '#1b5e20' } }}
          >
            Çıkış Yap
          </Button>
        </Toolbar>
      </AppBar>

      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        {success && (
          <Alert severity="success" sx={{ mb: 3, borderRadius: 2 }}>
            {success}
          </Alert>
        )}

        <Paper elevation={0} sx={{ p: 3, mb: 3, borderRadius: 2, backgroundColor: '#fff' }}>
          <Typography variant="h5" gutterBottom sx={{ color: '#2e7d32', display: 'flex', alignItems: 'center' }}>
            <SchoolIcon sx={{ mr: 1 }} /> Öğrenci Paneli
          </Typography>
          <Typography color="textSecondary" sx={{ mb: 3 }}>
            Derslerinizi görüntüleyin ve yoklamalara katılın
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
                    borderRadius: 2,
                    transition: 'transform 0.2s',
                    '&:hover': {
                      transform: 'translateY(-4px)',
                      boxShadow: 3
                    }
                  }}>
                    <CardContent>
                      <Typography variant="h5" gutterBottom sx={{ color: '#2e7d32' }}>
                        {course.name}
                      </Typography>
                      <Typography color="textSecondary" gutterBottom>
                        Ders Kodu: {course.code}
                      </Typography>
                      <Typography color="textSecondary" gutterBottom>
                        Program: {course.schedule}
                      </Typography>
                      <Box sx={{ mt: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                        {course.has_active_attendance && !course.already_attended && (
                          <Chip
                            icon={<CheckCircleIcon />}
                            label="Yoklama Aktif"
                            color="success"
                            sx={{ borderRadius: '16px' }}
                          />
                        )}
                        {course.already_attended && (
                          <Chip
                            icon={<EventAvailableIcon />}
                            label="Yoklamaya Katıldınız"
                            color="primary"
                            sx={{ borderRadius: '16px' }}
                          />
                        )}
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          )}
        </Paper>

        {/* Yoklama Katılım Dialog */}
        <Dialog 
          open={openDialog} 
          onClose={() => setOpenDialog(false)}
          PaperProps={{
            sx: { borderRadius: 2 }
          }}
        >
          <DialogTitle sx={{ backgroundColor: '#2e7d32', color: 'white' }}>
            Yoklamaya Katıl
          </DialogTitle>
          <DialogContent sx={{ mt: 2 }}>
            {error && (
              <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
                {error}
              </Alert>
            )}
            <TextField
              autoFocus
              margin="dense"
              label="Yoklama Kodu"
              fullWidth
              value={attendanceCode}
              onChange={(e) => setAttendanceCode(e.target.value.toUpperCase())}
              placeholder="Öğretmeninizin verdiği kodu girin"
              helperText="Yoklama kodunu büyük harflerle girin"
              sx={{
                '& .MuiOutlinedInput-root': {
                  '&.Mui-focused fieldset': {
                    borderColor: '#2e7d32',
                  },
                },
                '& .MuiInputLabel-root.Mui-focused': {
                  color: '#2e7d32',
                },
              }}
            />
          </DialogContent>
          <DialogActions sx={{ p: 2, pt: 0 }}>
            <Button 
              onClick={() => setOpenDialog(false)}
              sx={{ color: '#2e7d32' }}
            >
              İptal
            </Button>
            <Button 
              onClick={handleAttendanceSubmit} 
              variant="contained" 
              sx={{ 
                backgroundColor: '#2e7d32',
                '&:hover': { backgroundColor: '#1b5e20' }
              }}
            >
              Katıl
            </Button>
          </DialogActions>
        </Dialog>
      </Container>
    </Box>
  );
}

export default StudentDashboard; 