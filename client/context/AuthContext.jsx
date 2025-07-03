import { createContext, useEffect, useState } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import { io } from "socket.io-client";

const backendUrl = import.meta.env.VITE_BACKEND_URL;
axios.defaults.baseURL = backendUrl;
axios.defaults.withCredentials = true;

// ✅ Add interceptor to attach token to all requests
axios.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.token = token;
  return config;
});

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(localStorage.getItem("token"));
  const [authUser, setAuthUser] = useState(null);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [socket, setSocket] = useState(null);

  // ✅ Check auth on load
  const checkAuth = async () => {
    try {
      const { data } = await axios.get(`${backendUrl}/api/auth/check`);
      if (data.success) {
        setAuthUser(data.user);
        connectSocket(data.user);
      } else {
        logout(); // Token is invalid
      }
    } catch (error) {
      logout(); // Token is likely expired or corrupted
      toast.error(error.response?.data?.message || error.message);
    }
  };

  // ✅ Login function
  const login = async (state, credentials) => {
    try {
      const { data } = await axios.post(`/api/auth/${state}`, credentials);
      if (data.success) {
        setAuthUser(data.userData);
        connectSocket(data.userData);
        setToken(data.token);
        localStorage.setItem("token", data.token);
        toast.success(data.message);
      } else {
        toast.error(data.message);
      }
    } catch (error) {
      toast.error(error.response?.data?.message || error.message);
    }
  };

  // ✅ Logout function
  const logout = () => {
    localStorage.removeItem("token");
    setToken(null);
    setAuthUser(null);
    setOnlineUsers([]);
    toast.success("Logged out successfully");

    if (socket) {
      socket.disconnect();
      setSocket(null);
    }
  };

  // ✅ Profile update
  const updateProfile = async (body) => {
    try {
      const { data } = await axios.put("/api/auth/update-profile", body);
      if (data.success) {
        setAuthUser(data.user);
        toast.success("Profile updated successfully");
      }
    } catch (error) {
      toast.error(error.response?.data?.message || error.message);
    }
  };

  // ✅ Connect socket
  const connectSocket = (userData) => {
    if (!userData || socket?.connected) return;

    const newSocket = io(backendUrl, {
      query: { userId: userData._id },
    });

    newSocket.on("connect", () => {
      console.log("🔌 Socket connected:", newSocket.id);
    });

    // 🧹 Prevent duplicate listeners
    newSocket.off("getOnlineUsers");
    newSocket.on("getOnlineUsers", (userIds) => {
      setOnlineUsers(userIds);
    });

    setSocket(newSocket);
  };

  // ✅ Initial auth check
  useEffect(() => {
    if (token) {
      checkAuth();
    }

    return () => {
      if (socket) socket.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const value = {
    axios,
    authUser,
    onlineUsers,
    socket,
    login,
    logout,
    updateProfile,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
