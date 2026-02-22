/**
 * Manager: Add/Edit/Remove drivers. Persists to peopleStore; propagates to Team, Who's Driving, etc.
 */

import React, { useState, useMemo } from 'react';
import { listDrivers, addDriver, updateDriver, removeDriver, getDisplayName, getAvatarUrl, type Person } from '../../ops/peopleStore';
import { Avatar } from './Avatar';
import { Modal } from './Modal';

const AVATAR_PRESETS = [
  'https://randomuser.me/api/portraits/men/12.jpg',
  'https://randomuser.me/api/portraits/women/23.jpg',
  'https://randomuser.me/api/portraits/men/32.jpg',
  'https://randomuser.me/api/portraits/women/41.jpg',
  'https://randomuser.me/api/portraits/men/67.jpg',
  'https://randomuser.me/api/portraits/women/44.jpg',
  'https://randomuser.me/api/portraits/men/8.jpg',
  'https://randomuser.me/api/portraits/women/65.jpg',
  'https://randomuser.me/api/portraits/men/22.jpg',
  'https://randomuser.me/api/portraits/women/68.jpg',
];

type FormState = { fullName: string; email: string; phone: string; avatarUrl: string };

const emptyForm: FormState = { fullName: '', email: '', phone: '', avatarUrl: '' };

interface ManageDriversProps {
  onDriversChange?: () => void;
}

export function ManageDrivers({ onDriversChange }: ManageDriversProps) {
  const [drivers, setDrivers] = useState(listDrivers());
  const [addOpen, setAddOpen] = useState(false);
  const [editDriver, setEditDriver] = useState<Person | null>(null);
  const [removeDriverId, setRemoveDriverId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [error, setError] = useState('');

  const refresh = () => {
    setDrivers(listDrivers());
    onDriversChange?.();
  };

  const handleAddOpen = () => {
    setForm(emptyForm);
    setError('');
    setAddOpen(true);
  };

  const handleAddSubmit = () => {
    setError('');
    const result = addDriver({
      fullName: form.fullName,
      email: form.email,
      phone: form.phone || undefined,
      avatarUrl: form.avatarUrl || undefined,
    });
    if (result.error) {
      setError(result.error);
      return;
    }
    setAddOpen(false);
    refresh();
  };

  const handleEditOpen = (d: Person) => {
    setEditDriver(d);
    setForm({
      fullName: d.fullName,
      email: d.email,
      phone: d.phone ?? '',
      avatarUrl: d.avatarUrl ?? '',
    });
    setError('');
  };

  const handleEditSubmit = () => {
    if (!editDriver) return;
    setError('');
    const result = updateDriver(editDriver.id, {
      fullName: form.fullName,
      email: form.email,
      phone: form.phone || undefined,
      avatarUrl: form.avatarUrl || undefined,
    }, 'manager');
    if (result.error) {
      setError(result.error);
      return;
    }
    setEditDriver(null);
    refresh();
  };

  const handleRemoveConfirm = (id: string) => {
    removeDriver(id);
    setRemoveDriverId(null);
    refresh();
  };

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-900">Manage Drivers</h2>
        <button
          type="button"
          onClick={handleAddOpen}
          className="px-3 py-1.5 rounded-lg text-sm font-medium bg-p2p-blue text-white hover:bg-p2p-blue/90 focus:outline-none focus:ring-2 focus:ring-p2p-blue"
        >
          Add Driver
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/50">
              <th className="text-left py-3 px-4 font-semibold text-gray-700">Driver</th>
              <th className="text-left py-3 px-4 font-semibold text-gray-700">Email</th>
              <th className="text-right py-3 px-4 font-semibold text-gray-700">Actions</th>
            </tr>
          </thead>
          <tbody>
            {drivers.map((d) => (
              <tr key={d.id} className="border-b border-gray-50">
                <td className="py-3 px-4">
                  <div className="flex items-center gap-2">
                    <Avatar src={getAvatarUrl(d)} alt={getDisplayName(d)} name={d.fullName} size="sm" />
                    <span className="font-medium text-gray-900">{getDisplayName(d)}</span>
                  </div>
                </td>
                <td className="py-3 px-4 text-gray-600">{d.email}</td>
                <td className="py-3 px-4 text-right">
                  <button
                    type="button"
                    onClick={() => handleEditOpen(d)}
                    className="px-2 py-1 rounded text-p2p-blue hover:bg-p2p-light-blue/50 text-xs font-medium"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => setRemoveDriverId(d.id)}
                    className="ml-2 px-2 py-1 rounded text-p2p-red hover:bg-p2p-light-red/30 text-xs font-medium"
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add Driver">
        <DriverForm form={form} setForm={setForm} error={error} onSubmit={handleAddSubmit} onCancel={() => setAddOpen(false)} presets={AVATAR_PRESETS} />
      </Modal>

      <Modal open={!!editDriver} onClose={() => setEditDriver(null)} title="Edit Driver">
        {editDriver && (
          <DriverForm form={form} setForm={setForm} error={error} onSubmit={handleEditSubmit} onCancel={() => setEditDriver(null)} presets={AVATAR_PRESETS} />
        )}
      </Modal>

      {removeDriverId && (
        <Modal open={true} onClose={() => setRemoveDriverId(null)} title="Remove driver">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6">
            <p className="font-medium text-gray-900">Remove this driver?</p>
            <p className="text-sm text-gray-500 mt-1">They will no longer appear in Team or Who&apos;s Driving. If they are logged in, they will be signed out.</p>
            <div className="flex gap-3 mt-6">
              <button type="button" onClick={() => setRemoveDriverId(null)} className="flex-1 py-2 rounded-xl bg-gray-100 text-gray-700 font-medium">
                Cancel
              </button>
              <button type="button" onClick={() => handleRemoveConfirm(removeDriverId)} className="flex-1 py-2 rounded-xl bg-p2p-red text-white font-medium">
                Remove
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function DriverForm({
  form,
  setForm,
  error,
  onSubmit,
  onCancel,
  presets,
}: {
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
  error: string;
  onSubmit: () => void;
  onCancel: () => void;
  presets: string[];
}) {
  return (
    <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1">Full name *</label>
          <input
            type="text"
            value={form.fullName}
            onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
            className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:border-p2p-blue focus:ring-2 focus:ring-p2p-blue/20 outline-none"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1">Email *</label>
          <input
            type="email"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:border-p2p-blue focus:ring-2 focus:ring-p2p-blue/20 outline-none"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1">Phone (optional)</label>
          <input
            type="tel"
            value={form.phone}
            onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:border-p2p-blue focus:ring-2 focus:ring-p2p-blue/20 outline-none"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1">Avatar</label>
          <div className="flex flex-wrap gap-2 mb-2">
            {presets.map((url) => (
              <button
                key={url}
                type="button"
                onClick={() => setForm((f) => ({ ...f, avatarUrl: url }))}
                className={`rounded-full overflow-hidden border-2 ${form.avatarUrl === url ? 'border-p2p-blue' : 'border-transparent'}`}
              >
                <img src={url} alt="" className="w-10 h-10 object-cover" />
              </button>
            ))}
          </div>
          <input
            type="url"
            value={form.avatarUrl}
            onChange={(e) => setForm((f) => ({ ...f, avatarUrl: e.target.value }))}
            placeholder="Or paste image URL"
            className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:border-p2p-blue focus:ring-2 focus:ring-p2p-blue/20 outline-none text-sm"
          />
        </div>
      </div>
      {error && <p className="mt-2 text-sm text-p2p-red">{error}</p>}
      <div className="flex gap-3 mt-6">
        <button type="button" onClick={onCancel} className="flex-1 py-2.5 rounded-xl bg-gray-100 text-gray-700 font-medium">
          Cancel
        </button>
        <button type="button" onClick={onSubmit} className="flex-1 py-2.5 rounded-xl bg-p2p-blue text-white font-medium">
          Save
        </button>
      </div>
    </div>
  );
}
