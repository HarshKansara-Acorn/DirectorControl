import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';
import { useAuth } from './AuthContext';

const DirectorContext = createContext(null);

export const DirectorProvider = ({ children }) => {
  const { user, isAdmin } = useAuth();
  const [directors, setDirectors] = useState([]);
  const [selectedDirector, setSelectedDirector] = useState(null);

  useEffect(() => {
    if (user && isAdmin) {
      fetchDirectors();
    } else if (user && !isAdmin) {
      // Director sees their own data
      setSelectedDirector(user);
    }
  }, [user, isAdmin]);

  const fetchDirectors = async () => {
    try {
      const res = await api.get('/users/directors');
      setDirectors(res.data);
      if (res.data.length > 0 && !selectedDirector) {
        setSelectedDirector(res.data[0]);
      }
    } catch (err) {
      console.error('Failed to fetch directors:', err);
    }
  };

  const activeDirectorId = isAdmin ? selectedDirector?.id : user?.id;

  return (
    <DirectorContext.Provider value={{
      directors,
      selectedDirector,
      setSelectedDirector,
      activeDirectorId,
    }}>
      {children}
    </DirectorContext.Provider>
  );
};

export const useDirector = () => {
  const context = useContext(DirectorContext);
  if (!context) throw new Error('useDirector must be used within DirectorProvider');
  return context;
};
