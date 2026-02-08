import React, { useEffect, useState } from 'react';
import {
  getStreakData,
  getWeeklyProgress,
  setWeeklyGoal,
  type StreakData,
  type WeeklyProgress,
} from '@/lib/storage';
import { Flame, Target, Pencil, Check, X } from 'lucide-react';

interface StreakGoalCardProps {
  className?: string;
}

/**
 * Card displaying streak tracking and weekly goal progress
 */
export default function StreakGoalCard({ className = '' }: StreakGoalCardProps) {
  const [streak, setStreak] = useState<StreakData | null>(null);
  const [weeklyProgress, setWeeklyProgress] = useState<WeeklyProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditingGoal, setIsEditingGoal] = useState(false);
  const [goalInput, setGoalInput] = useState('');

  useEffect(() => {
    let mounted = true;

    async function loadData() {
      try {
        const [streakData, weeklyData] = await Promise.all([
          getStreakData(),
          getWeeklyProgress(),
        ]);

        if (mounted) {
          setStreak(streakData);
          setWeeklyProgress(weeklyData);
          setGoalInput(String(weeklyData.goal));
        }
      } catch (error) {
        console.error('Failed to load streak/goal data:', error);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadData();

    // Listen for todo changes to update streak/progress
    const handleTodoChange = () => {
      loadData();
    };

    document.addEventListener('todo-changed', handleTodoChange);
    document.addEventListener('table-changed', handleTodoChange);

    return () => {
      mounted = false;
      document.removeEventListener('todo-changed', handleTodoChange);
      document.removeEventListener('table-changed', handleTodoChange);
    };
  }, []);

  async function handleSaveGoal() {
    const newGoal = parseInt(goalInput, 10);
    if (isNaN(newGoal) || newGoal < 1) {
      setGoalInput(String(weeklyProgress?.goal ?? 5));
      setIsEditingGoal(false);
      return;
    }

    try {
      await setWeeklyGoal(newGoal);
      setWeeklyProgress((prev) => (prev ? { ...prev, goal: newGoal } : null));
      setIsEditingGoal(false);
    } catch (error) {
      console.error('Failed to save weekly goal:', error);
    }
  }

  function handleCancelEdit() {
    setGoalInput(String(weeklyProgress?.goal ?? 5));
    setIsEditingGoal(false);
  }

  if (loading) {
    return (
      <div className={`animate-pulse ${className}`}>
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <div className="h-16 bg-gray-200 dark:bg-gray-700 rounded" />
        </div>
      </div>
    );
  }

  const hasStreak = streak && streak.currentStreak > 0;
  const weeklyPercentage = weeklyProgress
    ? Math.min(100, Math.round((weeklyProgress.completed / weeklyProgress.goal) * 100))
    : 0;

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Streak Card */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div
            className={`p-2 rounded-lg ${
              hasStreak
                ? 'bg-orange-100 dark:bg-orange-900/20'
                : 'bg-gray-100 dark:bg-gray-700'
            }`}
          >
            <Flame
              className={`w-5 h-5 ${
                hasStreak
                  ? 'text-orange-500'
                  : 'text-gray-400 dark:text-gray-500'
              }`}
            />
          </div>
          <div className="flex-1">
            {hasStreak ? (
              <>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {streak.currentStreak} day{streak.currentStreak !== 1 ? 's' : ''}
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Current streak
                </p>
              </>
            ) : (
              <>
                <div className="text-sm font-medium text-gray-900 dark:text-white">
                  No active streak
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Complete an item to start!
                </p>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Weekly Goal Card */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium text-gray-900 dark:text-white">
              Weekly Goal
            </span>
          </div>
          {!isEditingGoal && (
            <button
              onClick={() => setIsEditingGoal(true)}
              className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              aria-label="Edit goal"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {isEditingGoal ? (
          <div className="flex items-center gap-2">
            <input
              type="number"
              min="1"
              max="100"
              value={goalInput}
              onChange={(e) => setGoalInput(e.target.value)}
              className="flex-1 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveGoal();
                if (e.key === 'Escape') handleCancelEdit();
              }}
            />
            <span className="text-sm text-gray-500 dark:text-gray-400">
              items/week
            </span>
            <button
              onClick={handleSaveGoal}
              className="p-1 text-green-600 hover:text-green-700 dark:text-green-400"
              aria-label="Save"
            >
              <Check className="w-4 h-4" />
            </button>
            <button
              onClick={handleCancelEdit}
              className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              aria-label="Cancel"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-baseline gap-1 mb-2">
              <span className="text-2xl font-bold text-gray-900 dark:text-white">
                {weeklyProgress?.completed ?? 0}
              </span>
              <span className="text-sm text-gray-500 dark:text-gray-400">
                / {weeklyProgress?.goal ?? 5} items
              </span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all duration-500 ${
                  weeklyPercentage >= 100 ? 'bg-green-500' : 'bg-primary'
                }`}
                style={{ width: `${weeklyPercentage}%` }}
              />
            </div>
            {weeklyPercentage >= 100 && (
              <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                Goal reached!
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
