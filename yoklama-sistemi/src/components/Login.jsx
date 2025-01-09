import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  Container,
  Paper,
  TextField,
  Button,
  Typography,
  Box,
  Alert,
  IconButton,
} from '@mui/material';
import TimerIcon from '@mui/icons-material/Timer';
import PersonIcon from '@mui/icons-material/Person';
import LockIcon from '@mui/icons-material/Lock';

function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const formData = new FormData();
      formData.append('username', email);
      formData.append('password', password);

      const response = await axios.post('http://localhost:8000/token', formData);
      
      localStorage.setItem('token', response.data.access_token);
      localStorage.setItem('userEmail', email);

      if (email.endsWith('@ogretmen.edu.tr')) {
        navigate('/teacher');
      } else if (email.endsWith('@ogrenci.edu.tr')) {
        navigate('/student');
      }
    } catch (err) {
      setError('E-posta veya şifre hatalı');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#ffffff',
        py: 3,
      }}
    >
      <Container component="main" maxWidth="xs">
        <Paper
          elevation={3}
          sx={{
            p: 4,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            borderRadius: 2,
            backgroundColor: 'white',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <Box
            sx={{
              width: '100%',
              height: '4px',
              position: 'absolute',
              top: 0,
              left: 0,
              background: 'linear-gradient(90deg, #1976d2 0%, #dc004e 100%)',
            }}
          />
          
          <Box sx={{ mb: 3, display: 'flex', alignItems: 'center' }}>
            <TimerIcon sx={{ fontSize: 40, mr: 1, color: '#1976d2' }} />
            <Typography component="h1" variant="h4" sx={{ color: '#1976d2', fontWeight: 'bold' }}>
              Yoklama Sistemi
            </Typography>
          </Box>

          {error && (
            <Alert severity="error" sx={{ mb: 2, width: '100%', borderRadius: 1 }}>
              {error}
            </Alert>
          )}

          <form onSubmit={handleLogin} style={{ width: '100%' }}>
            <Box sx={{ mb: 2 }}>
              <TextField
                required
                fullWidth
                label="E-posta"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                InputProps={{
                  startAdornment: <PersonIcon sx={{ mr: 1, color: 'text.secondary' }} />,
                }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    '&.Mui-focused fieldset': {
                      borderColor: '#1976d2',
                    },
                  },
                  '& .MuiInputLabel-root.Mui-focused': {
                    color: '#1976d2',
                  },
                }}
              />
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                Örnek: ogretmen@ogretmen.edu.tr veya ogrenci@ogrenci.edu.tr
              </Typography>
            </Box>

            <Box sx={{ mb: 3 }}>
              <TextField
                required
                fullWidth
                label="Şifre"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                InputProps={{
                  startAdornment: <LockIcon sx={{ mr: 1, color: 'text.secondary' }} />,
                }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    '&.Mui-focused fieldset': {
                      borderColor: '#1976d2',
                    },
                  },
                  '& .MuiInputLabel-root.Mui-focused': {
                    color: '#1976d2',
                  },
                }}
              />
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                Şifre: 123456
              </Typography>
            </Box>

            <Button
              type="submit"
              fullWidth
              variant="contained"
              disabled={loading}
              sx={{
                mt: 2,
                mb: 2,
                py: 1.5,
                backgroundColor: '#1976d2',
                '&:hover': {
                  backgroundColor: '#1565c0',
                },
                borderRadius: 1,
                textTransform: 'none',
                fontSize: '1.1rem',
              }}
            >
              {loading ? 'Giriş yapılıyor...' : 'Giriş Yap'}
            </Button>
          </form>
        </Paper>
      </Container>
    </Box>
  );
}

export default Login; 