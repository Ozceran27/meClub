import React, { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import LandingScreen from '../screens/LandingScreen';
import LoginScreen from '../screens/LoginScreen';
import DashboardShell from '../screens/DashboardShell';
import { useAuth } from './features/auth/useAuth';

function ProtectedClub({ children }) {
  const { isLogged, isClub, loading } = useAuth();
  if (loading) return <View style={{flex:1,alignItems:'center',justifyContent:'center'}}><ActivityIndicator /></View>;
  if (!isLogged) return <Navigate to="/login" replace />;
  if (!isClub)   return <Navigate to="/" replace />;
  return children;
}

function LogoutNow() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    (async () => {
      await logout();
      navigate('/login', { replace: true });
    })();
  }, []);
  return <View style={{flex:1,alignItems:'center',justifyContent:'center'}}><ActivityIndicator /></View>;
}

export default function RootNavigator() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingScreen />} />
        <Route path="/login" element={<LoginScreen />} />

        {/* Dashboard Club */}
        <Route
          path="/dashboard/*"
          element={
            <ProtectedClub>
              <DashboardShell />
            </ProtectedClub>
          }
        />

        <Route path="/logout" element={<LogoutNow />} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
