import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { FeedbackRow } from '../types';

/**
 * Manage feedback submission and viewing.
 *
 * Provides:
 * - A form to submit feedback (Settings page)
 * - A list of feedback entries (Admin page)
 * - Ability to update feedback status (Admin page)
 * - Status filtering (new, in_progress, resolved, dismissed)
 */

function useFeedback() {
  const [feedback, setFeedback] = useState<FeedbackRow[]>([]);
  const [newFeedback, setNewFeedback] = useState({
    user_id: '',
    feedback_type: '',
    message: '',
    status: 'new',
    admin_notes: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Submit a new feedback entry.
   * @param data - filled form values
   */
  const submitFeedback = useCallback(async () => {
    if (!newFeedback.user_id || !newFeedback.message) {
      setError('Please provide a user ID and a message.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase.from('feedback').insert({
        user_id: newFeedback.user_id,
        feedback_type: newFeedback.feedback_type,
        message: newFeedback.message,
        status: newFeedback.status,
        admin_notes: newFeedback.admin_notes,
      });

      if (error) throw error;

      setNewFeedback({
        user_id: '',
        feedback_type: '',
        message: '',
        status: 'new',
        admin_notes: '',
      });
      setFeedback(prev => [...prev, data]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit feedback.');
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Get all feedback entries.
   * @returns sorted by creation date (newest first)
   */
  const allFeedback = useMemo(() => {
    const rows = await supabase.from('feedback').select('*');
    return rows.data || [];
  }, []);

  /**
   * Get feedback filtered by status.
   * @param status - one of 'new', 'in_progress', 'resolved', 'dismissed'
   */
  const filteredFeedback = useMemo(() => {
    if (!allFeedback.length) return [];
    return allFeedback.filter(f => f.status === status);
  }, [allFeedback, status]);

  /**
   * Update a feedback entry's status.
   * @param id - feedback row UUID
   * @param status - new status
   */
  const updateFeedback = useCallback(async (id: string, status: FeedbackRow['status']) => {
    setLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase.from('feedback').update({
        status,
      }).eq('id', id);

      if (error) throw error;

      setFeedback(prev => prev.map(f => f.id === id ? { ...f, status } : f));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update feedback.');
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Remove a feedback entry (admin only).
   * @param id - feedback row UUID
   */
  const deleteFeedback = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);

    try {
      await supabase.from('feedback').delete().eq('id', id);
      setFeedback(prev => prev.filter(f => f.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete feedback.');
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    feedback: allFeedback,
    filteredFeedback,
    allFeedback,
    loading,
    error,
    submitFeedback,
    updateFeedback,
    deleteFeedback,
  };
}

export default useFeedback;