import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { usersApi } from '../services/api';
import { PencilIcon, PlusIcon, ShieldCheckIcon, TrashIcon, UserGroupIcon } from '@heroicons/react/24/outline';

const emptyForm = { email: '', firstName: '', lastName: '', password: '', status: 'active', roleIds: [] };
const statusLabel = { active: 'Actif', inactive: 'Inactif', suspended: 'Suspendu' };

export default function UsersAdminPage() {
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState(null);
  const [selectedRoleId, setSelectedRoleId] = useState('');
  const [rolePermissionIds, setRolePermissionIds] = useState([]);

  const permissionGroups = useMemo(() => permissions.reduce((acc, p) => {
    const key = p.module || 'general';
    acc[key] = [...(acc[key] || []), p.name];
    return acc;
  }, {}), [permissions]);

  const load = async () => {
    const [u, r, p, a] = await Promise.all([
      usersApi.getAll(), usersApi.roles(), usersApi.permissions(), usersApi.auditLogs(),
    ]);
    setUsers(u.data);
    setRoles(r.data);
    setPermissions(p.data);
    setAuditLogs(a.data);
    if (!selectedRoleId && r.data[0]) {
      setSelectedRoleId(String(r.data[0].id));
      setRolePermissionIds((r.data[0].permissions || []).map((p) => p.id));
    }
  };

  useEffect(() => { load().catch(() => toast.error('Chargement impossible')); }, []);

  const save = async (e) => {
    e.preventDefault();
    try {
      const payload = { ...form, roleIds: form.roleIds.map(Number) };
      if (editing) {
        delete payload.password;
        await usersApi.update(editing.id, payload);
      } else {
        await usersApi.create(payload);
      }
      toast.success(editing ? 'Utilisateur modifie' : 'Utilisateur cree');
      setForm(emptyForm);
      setEditing(null);
      await load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Operation impossible');
    }
  };

  const edit = (user) => {
    setEditing(user);
    setForm({
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      password: '',
      status: user.status || (user.isActive ? 'active' : 'inactive'),
      roleIds: (user.roles || []).map((r) => r.id),
    });
  };

  const toggleRole = (id) => {
    setForm((prev) => ({
      ...prev,
      roleIds: prev.roleIds.includes(id) ? prev.roleIds.filter((roleId) => roleId !== id) : [...prev.roleIds, id],
    }));
  };

  const selectRoleForEdit = (id) => {
    const role = roles.find((item) => item.id === Number(id));
    setSelectedRoleId(id);
    setRolePermissionIds((role?.permissions || []).map((p) => p.id));
  };

  const togglePermission = (id) => {
    setRolePermissionIds((prev) => (
      prev.includes(id) ? prev.filter((permissionId) => permissionId !== id) : [...prev, id]
    ));
  };

  const saveRolePermissions = async () => {
    const role = roles.find((item) => item.id === Number(selectedRoleId));
    if (!role) return;
    await usersApi.updateRole(role.id, {
      description: role.description,
      permissionIds: rolePermissionIds,
    });
    toast.success('Permissions du role mises a jour');
    await load();
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Administration utilisateurs</h1>
          <p className="page-subtitle">Comptes, statuts, roles, permissions et journal d'activite</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <form onSubmit={save} className="card xl:col-span-1 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center">
              {editing ? <PencilIcon className="w-5 h-5 text-indigo-600" /> : <PlusIcon className="w-5 h-5 text-indigo-600" />}
            </div>
            <h2 className="font-bold text-gray-900">{editing ? 'Modifier le compte' : 'Nouvel utilisateur'}</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input className="input" placeholder="Prenom" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} required />
            <input className="input" placeholder="Nom" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} required />
          </div>
          <input className="input" type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
          {!editing && <input className="input" type="password" placeholder="Mot de passe initial" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={6} />}
          <select className="input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
            <option value="active">Actif</option>
            <option value="inactive">Inactif</option>
            <option value="suspended">Suspendu</option>
          </select>
          <div>
            <label className="label">Roles</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {roles.map((role) => (
                <label key={role.id} className="flex items-center gap-2 rounded-xl border border-gray-200 p-2 text-sm">
                  <input type="checkbox" checked={form.roleIds.includes(role.id)} onChange={() => toggleRole(role.id)} />
                  <span>{role.description || role.name}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <button className="btn-primary" type="submit">{editing ? 'Enregistrer' : 'Creer'}</button>
            {editing && <button className="btn-secondary" type="button" onClick={() => { setEditing(null); setForm(emptyForm); }}>Annuler</button>}
          </div>
        </form>

        <div className="xl:col-span-2 table-container overflow-x-auto">
          <table className="w-full min-w-[760px]">
            <thead><tr><th className="th">Utilisateur</th><th className="th">Roles</th><th className="th">Statut</th><th className="th">Actions</th></tr></thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="tr-hover border-b border-gray-100">
                  <td className="td"><div className="font-semibold">{user.firstName} {user.lastName}</div><div className="text-gray-500">{user.email}</div></td>
                  <td className="td"><div className="flex flex-wrap gap-1">{(user.roles || []).map((r) => <span key={r.id} className="badge-blue">{r.description || r.name}</span>)}</div></td>
                  <td className="td"><span className={user.status === 'active' ? 'badge-green' : user.status === 'suspended' ? 'badge-red' : 'badge-gray'}>{statusLabel[user.status] || 'Actif'}</span></td>
                  <td className="td">
                    <div className="flex flex-wrap gap-2">
                      <button className="btn-ghost" onClick={() => edit(user)} type="button"><PencilIcon className="w-4 h-4" /></button>
                      <button className="btn-ghost" type="button" onClick={async () => { const password = window.prompt('Nouveau mot de passe'); if (password) { await usersApi.resetPassword(user.id, password); toast.success('Mot de passe reinitialise'); } }}>Reset</button>
                      <button className="btn-ghost" type="button" onClick={async () => { await usersApi.setStatus(user.id, user.status === 'active' ? 'inactive' : 'active'); await load(); }}>{user.status === 'active' ? 'Desactiver' : 'Activer'}</button>
                      <button className="btn-ghost text-red-600" type="button" onClick={async () => { await usersApi.delete(user.id); await load(); }}><TrashIcon className="w-4 h-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="card">
          <div className="flex items-center gap-3 mb-4"><ShieldCheckIcon className="w-6 h-6 text-emerald-600" /><h2 className="font-bold">Permissions disponibles</h2></div>
          <div className="flex flex-col sm:flex-row gap-2 mb-4">
            <select className="input" value={selectedRoleId} onChange={(e) => selectRoleForEdit(e.target.value)}>
              {roles.map((role) => <option key={role.id} value={role.id}>{role.description || role.name}</option>)}
            </select>
            <button className="btn-primary" type="button" onClick={saveRolePermissions}>Enregistrer droits</button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {Object.entries(permissionGroups).map(([module, items]) => (
              <div key={module} className="rounded-xl border border-gray-200 p-3">
                <div className="font-bold text-sm text-gray-900 mb-2">{module}</div>
                <div className="space-y-1">
                  {items.map((p) => {
                    const permission = permissions.find((item) => item.name === p);
                    return (
                      <label key={p} className="flex items-center gap-2 text-xs font-semibold text-gray-700">
                        <input
                          type="checkbox"
                          checked={rolePermissionIds.includes(permission?.id)}
                          onChange={() => permission && togglePermission(permission.id)}
                        />
                        <span>{p}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="card">
          <div className="flex items-center gap-3 mb-4"><UserGroupIcon className="w-6 h-6 text-indigo-600" /><h2 className="font-bold">Historique recent</h2></div>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {auditLogs.map((log) => (
              <div key={log.id} className="rounded-xl border border-gray-100 p-3 text-sm">
                <div className="font-semibold">{log.action}</div>
                <div className="text-gray-500">{new Date(log.createdAt).toLocaleString()} - {log.entity} #{log.entityId}</div>
              </div>
            ))}
            {!auditLogs.length && <p className="text-sm text-gray-500">Aucune action critique enregistree.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
