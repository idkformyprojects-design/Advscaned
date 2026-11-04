import { useEffect } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { ErrorBoundary } from './components/ErrorBoundary';
import { useStore } from './lib/store';
import Home from './pages/Home';
import SearchPage from './pages/SearchPage';
import AdDetail from './pages/AdDetail';
import PostAd from './pages/PostAd';
import Chats from './pages/Chats';
import ChatThread from './pages/ChatThread';
import Favorites from './pages/Favorites';
import SavedSearchesPage from './pages/SavedSearches';
import MyAds from './pages/MyAds';
import Profile from './pages/Profile';
import Notifications from './pages/Notifications';
import Login from './pages/Login';
import SellerProfile from './pages/SellerProfile';
import Insights from './pages/Insights';
import NotFound from './pages/NotFound';

function RequireAuth({ children }: { children: JSX.Element }) {
  const user = useStore((s) => s.user);
  const location = useLocation();
  if (!user) return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  return children;
}

export default function App() {
  const theme = useStore((s) => s.theme);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', theme === 'dark');
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'dark' ? '#060B14' : '#F4F6F8');
  }, [theme]);

  return (
    <ErrorBoundary>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<Home />} />
          <Route path="search" element={<SearchPage />} />
          <Route path="ad/:id" element={<AdDetail />} />
          <Route path="seller/:id" element={<SellerProfile />} />
          <Route path="login" element={<Login />} />
          <Route
            path="post"
            element={
              <RequireAuth>
                <PostAd />
              </RequireAuth>
            }
          />
          <Route
            path="post/:id"
            element={
              <RequireAuth>
                <PostAd />
              </RequireAuth>
            }
          />
          <Route
            path="chats"
            element={
              <RequireAuth>
                <Chats />
              </RequireAuth>
            }
          />
          <Route
            path="chats/:id"
            element={
              <RequireAuth>
                <ChatThread />
              </RequireAuth>
            }
          />
          <Route
            path="favorites"
            element={
              <RequireAuth>
                <Favorites />
              </RequireAuth>
            }
          />
          <Route
            path="saved"
            element={
              <RequireAuth>
                <SavedSearchesPage />
              </RequireAuth>
            }
          />
          <Route
            path="myads"
            element={
              <RequireAuth>
                <MyAds />
              </RequireAuth>
            }
          />
          <Route
            path="insights"
            element={
              <RequireAuth>
                <Insights />
              </RequireAuth>
            }
          />
          <Route
            path="profile"
            element={
              <RequireAuth>
                <Profile />
              </RequireAuth>
            }
          />
          <Route path="notifications" element={<Notifications />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </ErrorBoundary>
  );
}
