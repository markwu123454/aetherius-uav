import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, Navigate, RouterProvider } from "react-router-dom";
import './styles.css';
import {App} from './App.tsx';

import {Dashboard} from "@/components/pages/Dashboard.tsx";
import Telemetry from "@/components/pages/Telemetry";
import {MissionPlanner as Mission} from "@/components/pages/Mission";
import Manual from "@/components/pages/Manual";
import Logs from "@/components/pages/Logs";
import Settings from "@/components/pages/Settings";

const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    children: [
      { index: true, element: <Navigate to="/home" replace /> }, // redirect `/` to `/home`
      { path: "home", element: <Dashboard /> },
      { path: "telemetry", element: <Telemetry /> },
      { path: "mission", element: <Mission /> },
      { path: "manual", element: <Manual /> },
      { path: "logs", element: <Logs /> },
      { path: "settings", element: <Settings /> },
    ],
  },
]);

createRoot(document.getElementById('root')!).render(
  <>
    <RouterProvider router={router} />
  </>
);
