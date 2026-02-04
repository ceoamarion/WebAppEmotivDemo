"use client";

import { useState } from 'react';
import Dashboard from '@/components/Dashboard';
import Experience from '@/components/Experience';
import Tutorial from '@/components/Tutorial';
import MindStatesLibrary from '@/components/MindStatesLibrary';
import Records from '@/components/Records';
import Navigation from '@/components/Navigation';
import DataBar from '@/components/DataBar';
import { CortexProvider } from '@/context/CortexContext';
import styles from './page.module.css';

export default function Home() {
  const [activeTab, setActiveTab] = useState('dashboard');

  return (
    <CortexProvider>
      <div className={styles.appContainer}>
        <Navigation activeTab={activeTab} onTabChange={setActiveTab} />

        <main className={styles.main}>
          {activeTab === 'dashboard' && <Dashboard />}
          {activeTab === 'experience' && <Experience />}
          {activeTab === 'tutorial' && <Tutorial isConnected={false} />}
          {activeTab === 'mindstates' && <MindStatesLibrary />}
          {activeTab === 'records' && <Records />}
        </main>

        <DataBar />
      </div>
    </CortexProvider>
  );
}
