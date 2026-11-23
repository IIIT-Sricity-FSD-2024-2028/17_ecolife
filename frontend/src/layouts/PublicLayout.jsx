import React from 'react';
import { Outlet } from 'react-router-dom';

export function PublicLayout() {
  return (
    <div className="min-h-screen flex flex-col bg-paper">
      <Outlet />
    </div>
  );
}
