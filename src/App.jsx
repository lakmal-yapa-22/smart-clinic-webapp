import React, { useEffect, useState, useRef, useCallback } from 'react';
import './styles.css';

/* ══════════════════════════════════════════
   API CONFIG — proxied through Vite
══════════════════════════════════════════ */
const BASE_URL = import.meta.env.VITE_GATEWAY_URL || '';
const PA = `${BASE_URL}/api/patients`;
const AA = `${BASE_URL}/api/appointments`;
const BA = `${BASE_URL}/api/billings`;

/* ══════════════════════════════════════════
   HTTP HELPER
══════════════════════════════════════════ */
async function http(url, opts = {}) {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...opts.headers },
    ...opts,
  });
  if (!res.ok) {
    const t = await res.text().catch(() => res.statusText);
    throw new Error(t || res.statusText);
  }
  if (res.status === 204) return null;
  return res.json().catch(() => null);
}

/* ══════════════════════════════════════════
   HELPERS
══════════════════════════════════════════ */
function initials(p) {
  return ((p?.firstName || '?')[0] + (p?.lastName || '')[0]).toUpperCase();
}

function StatusBadge({ status }) {
  const map = {
    Scheduled: 'sb-scheduled', SCHEDULED: 'sb-scheduled',
    Completed: 'sb-completed', COMPLETED: 'sb-completed',
    Cancelled: 'sb-cancelled', CANCELLED: 'sb-cancelled',
    Paid: 'sb-paid', PAID: 'sb-paid',
    Pending: 'sb-pending', PENDING: 'sb-pending',
  };
  return <span className={`sbadge ${map[status] || 'sb-pending'}`}>{status}</span>;
}

/* ══════════════════════════════════════════
   IMAGE UPLOAD ZONE
══════════════════════════════════════════ */
function ImageZone({ preview, onFile }) {
  const [drag, setDrag] = useState(false);
  const ref = useRef();

  const handle = (file) => {
    if (!file || !file.type.startsWith('image/')) return;
    onFile(file);
  };

  return (
    <div
      className={`img-upload-zone ${drag ? 'drag-over' : ''}`}
      onClick={() => ref.current.click()}
      onDragOver={e => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={e => { e.preventDefault(); setDrag(false); handle(e.dataTransfer.files[0]); }}
    >
      {preview ? (
        <div className="img-preview-wrap">
          <img src={preview} alt="preview" className="img-preview-circle" />
          <div className="img-change-overlay">🔄</div>
        </div>
      ) : (
        <div className="img-placeholder">
          <div className="img-placeholder-icon">📷</div>
          <div className="img-hint">
            <strong>Click or drag &amp; drop</strong>
            <small>PNG · JPG · WEBP — max 10 MB</small>
          </div>
        </div>
      )}
      <input
        ref={ref}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={e => handle(e.target.files[0])}
      />
    </div>
  );
}

/* ══════════════════════════════════════════
   MODAL WRAPPER
══════════════════════════════════════════ */
function Modal({ open, onClose, title, size, children, footer }) {
  useEffect(() => {
    const esc = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [onClose]);

  if (!open) return null;

  return (
    <div className="modal-overlay" onClick={e => { if (e.target.classList.contains('modal-overlay')) onClose(); }}>
      <div className={`modal-box ${size === 'lg' ? 'modal-box-lg' : ''}`}>
        <div className="modal-head">
          <div className="modal-title">{title}</div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════
   TOAST SYSTEM
══════════════════════════════════════════ */
function Toasts({ toasts }) {
  return (
    <div className="toast-wrap">
      {toasts.map(t => (
        <div key={t.id} className={`toast toast-${t.type}`}>
          <span>{t.type === 'ok' ? '✅' : t.type === 'err' ? '❌' : 'ℹ️'}</span>
          <span>{t.msg}</span>
        </div>
      ))}
    </div>
  );
}

function useToast() {
  const [toasts, setToasts] = useState([]);
  const add = useCallback((msg, type = 'ok') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, msg, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500);
  }, []);
  return { toasts, toast: add };
}

/* ══════════════════════════════════════════
   PATIENT FORM MODAL
══════════════════════════════════════════ */
const EMPTY_P = { firstName: '', lastName: '', age: '', gender: '', email: '', phone: '', bloodGroup: '', address: '' };

function PatientFormModal({ open, onClose, editData, onSaved, toast }) {
  const [form, setForm] = useState(EMPTY_P);
  const [imgFile, setImgFile] = useState(null);
  const [imgPreview, setImgPreview] = useState('');
  const [saving, setSaving] = useState(false);
  const isEdit = !!editData;

  useEffect(() => {
    if (open) {
      if (editData) {
        setForm({
          firstName: editData.firstName || '',
          lastName: editData.lastName || '',
          age: editData.age || '',
          gender: editData.gender || '',
          email: editData.email || '',
          phone: editData.phone || '',
          bloodGroup: editData.bloodGroup || '',
          address: editData.address || '',
        });
        setImgPreview(editData.imageUrl ? `${PA}/images/${editData.imageUrl.split('/').pop()}` : '');
      } else {
        setForm(EMPTY_P);
        setImgPreview('');
      }
      setImgFile(null);
    }
  }, [open, editData]);

  const handleFile = (file) => {
    setImgFile(file);
    const r = new FileReader();
    r.onload = e => setImgPreview(e.target.result);
    r.readAsDataURL(file);
  };

  const f = (k) => (e) => setForm(prev => ({ ...prev, [k]: e.target.value }));

  const save = async () => {
    if (!form.firstName.trim() || !form.lastName.trim()) {
      toast('First & last name required', 'err'); return;
    }
    setSaving(true);
    const payload = {
      ...form,
      age: form.age ? +form.age : null,
      gender: form.gender || null,
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      bloodGroup: form.bloodGroup || null,
      address: form.address.trim() || null,
    };
    try {
      let saved;
      if (isEdit) {
        saved = await http(`${PA}/${editData.id}`, { method: 'PUT', body: JSON.stringify(payload) });
      } else {
        saved = await http(PA, { method: 'POST', body: JSON.stringify(payload) });
      }
      if (imgFile && saved?.id) {
        const fd = new FormData();
        fd.append('file', imgFile);
        await fetch(`${PA}/${saved.id}/image`, { method: 'POST', body: fd });
      }
      toast(isEdit ? 'Patient updated!' : 'Patient added!');
      onSaved();
      onClose();
    } catch (e) {
      toast('Error: ' + e.message, 'err');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit Patient' : 'Add New Patient'}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={save} disabled={saving}>
            {saving ? 'Saving…' : isEdit ? 'Update Patient' : 'Save Patient'}
          </button>
        </>
      }
    >
      {/* Photo upload */}
      <div className="form-field col-full" style={{ marginBottom: '1rem' }}>
        <label>Patient Photo</label>
        <ImageZone preview={imgPreview} onFile={handleFile} />
      </div>

      <div className="form-2col">
        <div className="form-field">
          <label>First Name *</label>
          <input placeholder="Kamal" value={form.firstName} onChange={f('firstName')} />
        </div>
        <div className="form-field">
          <label>Last Name *</label>
          <input placeholder="Perera" value={form.lastName} onChange={f('lastName')} />
        </div>
        <div className="form-field">
          <label>Age</label>
          <input type="number" placeholder="30" min="0" max="150" value={form.age} onChange={f('age')} />
        </div>
        <div className="form-field">
          <label>Gender</label>
          <select value={form.gender} onChange={f('gender')}>
            <option value="">Select…</option>
            <option>Male</option>
            <option>Female</option>
            <option>Other</option>
          </select>
        </div>
        <div className="form-field">
          <label>Email</label>
          <input type="email" placeholder="kamal@example.com" value={form.email} onChange={f('email')} />
        </div>
        <div className="form-field">
          <label>Phone</label>
          <input placeholder="+94 77 123 4567" value={form.phone} onChange={f('phone')} />
        </div>
        <div className="form-field">
          <label>Blood Group</label>
          <select value={form.bloodGroup} onChange={f('bloodGroup')}>
            <option value="">Select…</option>
            {['A+','A-','B+','B-','AB+','AB-','O+','O-'].map(bg => <option key={bg}>{bg}</option>)}
          </select>
        </div>
        <div className="form-field" />
        <div className="form-field col-full">
          <label>Address</label>
          <textarea placeholder="No. 12, Temple Road, Colombo 03" value={form.address} onChange={f('address')} />
        </div>
      </div>
    </Modal>
  );
}

/* ══════════════════════════════════════════
   PATIENT VIEW MODAL
══════════════════════════════════════════ */
function PatientViewModal({ open, onClose, patient, onEdit }) {
  if (!patient) return null;
  const imgSrc = patient.imageUrl ? `${PA}/images/${patient.imageUrl.split('/').pop()}` : null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Patient Profile"
      size="lg"
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>Close</button>
          <button className="btn btn-amber" onClick={() => { onClose(); onEdit(patient); }}>✏ Edit</button>
        </>
      }
    >
      <div className="profile-top">
        {imgSrc
          ? <img src={imgSrc} alt={patient.firstName} className="profile-photo" />
          : <div className="profile-initials-lg">{initials(patient)}</div>
        }
        <div>
          <div className="profile-name">{patient.firstName} {patient.lastName}</div>
          <div className="profile-pid">Patient #{String(patient.id).padStart(5, '0')}</div>
          <div className="card-tags" style={{ marginTop: 8 }}>
            {patient.gender && <span className="ctag ct-g">{patient.gender}</span>}
            {patient.age && <span className="ctag ct-a">{patient.age} years</span>}
            {patient.bloodGroup && <span className="ctag ct-b">{patient.bloodGroup}</span>}
          </div>
        </div>
      </div>

      <div className="detail-grid">
        <div className="detail-item">
          <div className="detail-label">Email</div>
          <div className="detail-value">{patient.email || '—'}</div>
        </div>
        <div className="detail-item">
          <div className="detail-label">Phone</div>
          <div className="detail-value">{patient.phone || '—'}</div>
        </div>
        <div className="detail-item">
          <div className="detail-label">Age</div>
          <div className="detail-value">{patient.age || '—'}</div>
        </div>
        <div className="detail-item">
          <div className="detail-label">Gender</div>
          <div className="detail-value">{patient.gender || '—'}</div>
        </div>
        <div className="detail-item">
          <div className="detail-label">Blood Group</div>
          <div className="detail-value">{patient.bloodGroup || '—'}</div>
        </div>
        <div className="detail-item full">
          <div className="detail-label">Address</div>
          <div className="detail-value">{patient.address || '—'}</div>
        </div>
      </div>
    </Modal>
  );
}

/* ══════════════════════════════════════════
   DELETE CONFIRM MODAL
══════════════════════════════════════════ */
function DeleteModal({ open, onClose, title, message, onConfirm }) {
  const [loading, setLoading] = useState(false);
  const confirm = async () => {
    setLoading(true);
    try { await onConfirm(); onClose(); }
    catch (e) { /* handled outside */ }
    finally { setLoading(false); }
  };
  return (
    <Modal open={open} onClose={onClose} title="Confirm Delete">
      <div className="del-confirm">
        <div className="del-icon">⚠️</div>
        <div className="del-title">{title}</div>
        <div className="del-msg">{message}</div>
        <div className="del-btns">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-danger" onClick={confirm} disabled={loading}>
            {loading ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

/* ══════════════════════════════════════════
   APPOINTMENT FORM MODAL
══════════════════════════════════════════ */
const EMPTY_A = { patientId: '', doctorName: '', appointmentDate: '', status: '', notes: '' };

function ApptFormModal({ open, onClose, editData, onSaved, toast }) {
  const [form, setForm] = useState(EMPTY_A);
  const [saving, setSaving] = useState(false);
  const isEdit = !!editData;

  useEffect(() => {
    if (open) {
      setForm(editData
        ? { patientId: editData.patientId || '', doctorName: editData.doctorName || '', appointmentDate: editData.appointmentDate || '', status: editData.status || '', notes: editData.notes || '' }
        : EMPTY_A
      );
    }
  }, [open, editData]);

  const f = (k) => (e) => setForm(prev => ({ ...prev, [k]: e.target.value }));

  const save = async () => {
    if (!form.patientId || !form.doctorName || !form.appointmentDate) {
      toast('Patient ID, Doctor & Date required', 'err'); return;
    }
    setSaving(true);
    const payload = { patientId: +form.patientId, doctorName: form.doctorName, appointmentDate: form.appointmentDate, status: form.status || 'Scheduled', notes: form.notes || null };
    try {
      if (isEdit) await http(`${AA}/${editData.id}`, { method: 'PUT', body: JSON.stringify(payload) });
      else await http(AA, { method: 'POST', body: JSON.stringify(payload) });
      toast(isEdit ? 'Appointment updated!' : 'Appointment created!');
      onSaved();
      onClose();
    } catch (e) {
      toast('Error: ' + e.message, 'err');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit Appointment' : 'New Appointment'}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={save} disabled={saving}>
            {saving ? 'Saving…' : isEdit ? 'Update' : 'Save'}
          </button>
        </>
      }
    >
      <div className="form-2col">
        <div className="form-field">
          <label>Patient ID *</label>
          <input type="number" placeholder="1" value={form.patientId} onChange={f('patientId')} />
        </div>
        <div className="form-field">
          <label>Doctor Name *</label>
          <input placeholder="Dr. Perera" value={form.doctorName} onChange={f('doctorName')} />
        </div>
        <div className="form-field">
          <label>Date *</label>
          <input type="date" value={form.appointmentDate} onChange={f('appointmentDate')} />
        </div>
        <div className="form-field">
          <label>Status</label>
          <select value={form.status} onChange={f('status')}>
            <option value="">Select…</option>
            <option>Scheduled</option>
            <option>Completed</option>
            <option>Cancelled</option>
          </select>
        </div>
        <div className="form-field col-full">
          <label>Notes</label>
          <textarea placeholder="Additional notes…" value={form.notes} onChange={f('notes')} />
        </div>
      </div>
    </Modal>
  );
}

/* ══════════════════════════════════════════
   BILLING FORM MODAL
══════════════════════════════════════════ */
const EMPTY_B = { patientId: '', amount: '', paymentStatus: '', description: '' };

function BillFormModal({ open, onClose, editData, onSaved, toast }) {
  const [form, setForm] = useState(EMPTY_B);
  const [saving, setSaving] = useState(false);
  const isEdit = !!editData;

  useEffect(() => {
    if (open) {
      setForm(editData
        ? { patientId: editData.patientId || '', amount: editData.amount || '', paymentStatus: editData.paymentStatus || '', description: editData.description || '' }
        : EMPTY_B
      );
    }
  }, [open, editData]);

  const f = (k) => (e) => setForm(prev => ({ ...prev, [k]: e.target.value }));

  const save = async () => {
    if (!form.patientId || !form.amount || !form.paymentStatus) {
      toast('Patient ID, Amount & Status required', 'err'); return;
    }
    setSaving(true);
    const payload = { patientId: +form.patientId, amount: parseFloat(form.amount), paymentStatus: form.paymentStatus, description: form.description || null };
    try {
      if (isEdit) await http(`${BA}/${editData.id}`, { method: 'PUT', body: JSON.stringify(payload) });
      else await http(BA, { method: 'POST', body: JSON.stringify(payload) });
      toast(isEdit ? 'Bill updated!' : 'Bill created!');
      onSaved();
      onClose();
    } catch (e) {
      toast('Error: ' + e.message, 'err');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit Bill' : 'Add Bill'}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={save} disabled={saving}>
            {saving ? 'Saving…' : isEdit ? 'Update' : 'Save'}
          </button>
        </>
      }
    >
      <div className="form-2col">
        <div className="form-field">
          <label>Patient ID *</label>
          <input type="number" placeholder="1" value={form.patientId} onChange={f('patientId')} />
        </div>
        <div className="form-field">
          <label>Amount (LKR) *</label>
          <input type="number" step="0.01" placeholder="5000.00" value={form.amount} onChange={f('amount')} />
        </div>
        <div className="form-field">
          <label>Payment Status *</label>
          <select value={form.paymentStatus} onChange={f('paymentStatus')}>
            <option value="">Select…</option>
            <option>Pending</option>
            <option>Paid</option>
            <option>Cancelled</option>
          </select>
        </div>
        <div className="form-field" />
        <div className="form-field col-full">
          <label>Description</label>
          <textarea placeholder="Consultation, Lab tests, Medication…" value={form.description} onChange={f('description')} />
        </div>
      </div>
    </Modal>
  );
}

/* ══════════════════════════════════════════
   DASHBOARD PAGE
══════════════════════════════════════════ */
function Dashboard({ patients, appointments, bills, onViewPatient, onNavTo }) {
  const revenue = bills.filter(b => b.paymentStatus === 'Paid' || b.paymentStatus === 'PAID').reduce((s, b) => s + (+b.amount || 0), 0);
  const pending = bills.filter(b => b.paymentStatus === 'Pending' || b.paymentStatus === 'PENDING').length;

  return (
    <div className="tab-content">
      <div className="kpi-strip">
        <div className="kpi-card k-teal">
          <div className="kpi-label">Total Patients</div>
          <div className="kpi-val">{patients.length}</div>
          <div className="kpi-sub">Registered records</div>
        </div>
        <div className="kpi-card k-blue">
          <div className="kpi-label">Appointments</div>
          <div className="kpi-val">{appointments.length}</div>
          <div className="kpi-sub">All time</div>
        </div>
        <div className="kpi-card k-amber">
          <div className="kpi-label">Revenue</div>
          <div className="kpi-val" style={{ fontSize: '1.35rem' }}>LKR {revenue.toLocaleString()}</div>
          <div className="kpi-sub">Collected from paid bills</div>
        </div>
        <div className="kpi-card k-rose">
          <div className="kpi-label">Pending Bills</div>
          <div className="kpi-val">{pending}</div>
          <div className="kpi-sub">Awaiting payment</div>
        </div>
      </div>

      <div className="dash-panels">
        <div className="panel">
          <div className="panel-header">
            <div className="panel-title">Recent Patients</div>
            <button className="btn-link" onClick={() => onNavTo('patients')}>View all →</button>
          </div>
          <div className="recent-list">
            {patients.length === 0 && <div className="empty-state"><div className="empty-icon">👥</div><div className="empty-title">No patients yet</div></div>}
            {patients.slice(0, 6).map(p => {
              const imgSrc = p.imageUrl ? `${PA}/images/${p.imageUrl.split('/').pop()}` : null;
              return (
                <div className="recent-row" key={p.id} onClick={() => onViewPatient(p)}>
                  <div className="row-av" style={{ background: 'linear-gradient(135deg,#1a2a44,#0d1826)', color: 'var(--teal)' }}>
                    {imgSrc ? <img src={imgSrc} alt={p.firstName} onError={e => e.target.style.display='none'} /> : initials(p)}
                  </div>
                  <div>
                    <div className="row-name">{p.firstName} {p.lastName}</div>
                    <div className="row-sub">{p.email || p.phone || 'No contact info'}</div>
                  </div>
                  <div className="row-right">
                    {p.bloodGroup && <span className="ctag ct-b">{p.bloodGroup}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <div className="panel-title">Recent Appointments</div>
            <button className="btn-link" onClick={() => onNavTo('appointments')}>View all →</button>
          </div>
          <div className="recent-list">
            {appointments.length === 0 && <div className="empty-state"><div className="empty-icon">📅</div><div className="empty-title">No appointments yet</div></div>}
            {appointments.slice(0, 6).map(a => (
              <div className="recent-row" key={a.id}>
                <div className="row-av" style={{ background: 'var(--blue-soft)', color: 'var(--blue)', fontSize: '1rem' }}>📅</div>
                <div>
                  <div className="row-name">{a.doctorName || 'Unknown Doctor'}</div>
                  <div className="row-sub">Patient #{a.patientId} · {a.appointmentDate || '—'}</div>
                </div>
                <div className="row-right"><StatusBadge status={a.status} /></div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent billing */}
      <div className="panel">
        <div className="panel-header">
          <div className="panel-title">Recent Billing</div>
          <button className="btn-link" onClick={() => onNavTo('billing')}>View all →</button>
        </div>
        <table>
          <thead>
            <tr>
              <th>Patient</th>
              <th>Amount</th>
              <th>Status</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            {bills.length === 0 && (
              <tr><td colSpan={4} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text3)' }}>No billing records</td></tr>
            )}
            {bills.slice(0, 5).map(b => (
              <tr key={b.id}>
                <td><span className="pid-pill">#{b.patientId}</span></td>
                <td><span className="amount-col">LKR {Number(b.amount || 0).toLocaleString()}</span></td>
                <td><StatusBadge status={b.paymentStatus} /></td>
                <td><span className="no-wrap">{b.description || '—'}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════
   PATIENTS PAGE
══════════════════════════════════════════ */
function PatientsPage({ patients, loading, onReload, toast }) {
  const [search, setSearch] = useState('');
  const [gender, setGender] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [editData, setEditData] = useState(null);
  const [viewData, setViewData] = useState(null);
  const [delData, setDelData] = useState(null);

  const filtered = patients.filter(p =>
    [p.firstName, p.lastName, p.email, p.phone, p.address].filter(Boolean).join(' ').toLowerCase().includes(search.toLowerCase()) &&
    (!gender || p.gender === gender)
  );

  const handleDelete = async () => {
    await http(`${PA}/${delData.id}`, { method: 'DELETE' });
    toast(`Deleted ${delData.firstName} ${delData.lastName}`);
    onReload();
  };

  return (
    <div className="tab-content">
      <div className="sec-header">
        <div>
          <div className="sec-title">Patients</div>
          <div className="sec-sub">Manage patient records and photo profiles</div>
        </div>
        <button className="btn btn-primary" onClick={() => { setEditData(null); setAddOpen(true); }}>＋ Add Patient</button>
      </div>

      <div className="toolbar">
        <div className="search-wrap">
          <span className="search-ic">🔍</span>
          <input placeholder="Search name, email, phone…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="filter-select" value={gender} onChange={e => setGender(e.target.value)}>
          <option value="">All Genders</option>
          <option>Male</option>
          <option>Female</option>
          <option>Other</option>
        </select>
        <button className="btn btn-ghost" onClick={onReload}>↺ Refresh</button>
      </div>

      {loading ? (
        <div className="load-state"><div className="spinner" /><span>Loading patients…</span></div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">👥</div>
          <div className="empty-title">No patients found</div>
          <div className="empty-sub">Try adjusting your search or add a new patient</div>
        </div>
      ) : (
        <div className="cards-grid">
          {filtered.map((p, i) => {
            const imgSrc = p.imageUrl ? `${PA}/images/${p.imageUrl.split('/').pop()}` : null;
            return (
              <div className="patient-card" key={p.id} style={{ animationDelay: `${i * 0.04}s` }}>
                <div className="card-top">
                  <div className="card-photo-wrap">
                    {imgSrc
                      ? <img src={imgSrc} alt={p.firstName} className="card-photo" onError={e => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'grid'; }} />
                      : null}
                    <div className="card-initials" style={{ display: imgSrc ? 'none' : 'grid' }}>{initials(p)}</div>
                    <div className="photo-edit-btn" title="Change photo" onClick={e => { e.stopPropagation(); setEditData(p); setAddOpen(true); }}>✏</div>
                  </div>
                  <div className="card-info">
                    <div className="card-name">{p.firstName} {p.lastName}</div>
                    <div className="card-pid">#{String(p.id).padStart(5, '0')}</div>
                    <div className="card-tags">
                      {p.gender && <span className="ctag ct-g">{p.gender}</span>}
                      {p.age && <span className="ctag ct-a">{p.age}y</span>}
                      {p.bloodGroup && <span className="ctag ct-b">{p.bloodGroup}</span>}
                    </div>
                  </div>
                </div>
                <div className="card-body">
                  {p.email && <div className="info-row"><span className="info-ic">✉</span><span>{p.email}</span></div>}
                  {p.phone && <div className="info-row"><span className="info-ic">☏</span><span>{p.phone}</span></div>}
                  {p.address && <div className="info-row"><span className="info-ic">◎</span><span>{p.address}</span></div>}
                  {!p.email && !p.phone && !p.address && <div style={{ color: 'var(--text3)', fontSize: '.76rem' }}>No contact information</div>}
                </div>
                <div className="card-foot">
                  <button className="btn btn-ghost btn-sm" onClick={() => setViewData(p)}>👁 View</button>
                  <button className="btn btn-amber btn-sm" onClick={() => { setEditData(p); setAddOpen(true); }}>✏ Edit</button>
                  <button className="btn btn-danger btn-sm" onClick={() => setDelData(p)}>🗑</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <PatientFormModal open={addOpen} onClose={() => { setAddOpen(false); setEditData(null); }} editData={editData} onSaved={onReload} toast={toast} />
      <PatientViewModal open={!!viewData} onClose={() => setViewData(null)} patient={viewData} onEdit={(p) => { setEditData(p); setAddOpen(true); }} />
      <DeleteModal
        open={!!delData}
        onClose={() => setDelData(null)}
        title={`Delete "${delData?.firstName} ${delData?.lastName}"?`}
        message="This will permanently remove the patient record and cannot be undone."
        onConfirm={handleDelete}
      />
    </div>
  );
}

/* ══════════════════════════════════════════
   APPOINTMENTS PAGE
══════════════════════════════════════════ */
function AppointmentsPage({ appointments, loading, onReload, toast }) {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [editData, setEditData] = useState(null);
  const [delId, setDelId] = useState(null);

  const filtered = appointments.filter(a =>
    [a.doctorName, String(a.patientId), a.notes].filter(Boolean).join(' ').toLowerCase().includes(search.toLowerCase()) &&
    (!status || a.status === status)
  );

  const handleDelete = async () => {
    await http(`${AA}/${delId}`, { method: 'DELETE' });
    toast('Appointment deleted');
    onReload();
  };

  return (
    <div className="tab-content">
      <div className="sec-header">
        <div>
          <div className="sec-title">Appointments</div>
          <div className="sec-sub">Schedule and track patient appointments</div>
        </div>
        <button className="btn btn-primary" onClick={() => { setEditData(null); setAddOpen(true); }}>＋ New Appointment</button>
      </div>

      <div className="toolbar">
        <div className="search-wrap">
          <span className="search-ic">🔍</span>
          <input placeholder="Search doctor, patient ID, notes…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="filter-select" value={status} onChange={e => setStatus(e.target.value)}>
          <option value="">All Status</option>
          <option>Scheduled</option>
          <option>Completed</option>
          <option>Cancelled</option>
        </select>
        <button className="btn btn-ghost" onClick={onReload}>↺ Refresh</button>
      </div>

      {loading ? (
        <div className="load-state"><div className="spinner" /><span>Loading…</span></div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Patient</th>
                <th>Doctor</th>
                <th>Date</th>
                <th>Status</th>
                <th>Notes</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text3)' }}>No appointments found</td></tr>
              )}
              {filtered.map(a => (
                <tr key={a.id}>
                  <td><span className="pid-pill">#{a.patientId}</span></td>
                  <td><strong>{a.doctorName || '—'}</strong></td>
                  <td>{a.appointmentDate || '—'}</td>
                  <td><StatusBadge status={a.status} /></td>
                  <td><span className="no-wrap">{a.notes || '—'}</span></td>
                  <td>
                    <div className="td-actions">
                      <button className="btn btn-amber btn-sm" onClick={() => { setEditData(a); setAddOpen(true); }}>✏</button>
                      <button className="btn btn-danger btn-sm" onClick={() => setDelId(a.id)}>🗑</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ApptFormModal open={addOpen} onClose={() => { setAddOpen(false); setEditData(null); }} editData={editData} onSaved={onReload} toast={toast} />
      <DeleteModal open={!!delId} onClose={() => setDelId(null)} title="Remove this appointment?" message="This appointment record will be permanently deleted." onConfirm={handleDelete} />
    </div>
  );
}

/* ══════════════════════════════════════════
   BILLING PAGE
══════════════════════════════════════════ */
function BillingPage({ bills, loading, onReload, toast }) {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [editData, setEditData] = useState(null);
  const [delId, setDelId] = useState(null);

  const filtered = bills.filter(b =>
    [String(b.patientId), b.description].filter(Boolean).join(' ').toLowerCase().includes(search.toLowerCase()) &&
    (!status || b.paymentStatus === status)
  );

  const handleDelete = async () => {
    await http(`${BA}/${delId}`, { method: 'DELETE' });
    toast('Bill deleted');
    onReload();
  };

  return (
    <div className="tab-content">
      <div className="sec-header">
        <div>
          <div className="sec-title">Billing</div>
          <div className="sec-sub">Invoice and payment management</div>
        </div>
        <button className="btn btn-primary" onClick={() => { setEditData(null); setAddOpen(true); }}>＋ Add Bill</button>
      </div>

      <div className="toolbar">
        <div className="search-wrap">
          <span className="search-ic">🔍</span>
          <input placeholder="Search patient ID, description…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="filter-select" value={status} onChange={e => setStatus(e.target.value)}>
          <option value="">All Status</option>
          <option>Pending</option>
          <option>Paid</option>
          <option>Cancelled</option>
        </select>
        <button className="btn btn-ghost" onClick={onReload}>↺ Refresh</button>
      </div>

      {loading ? (
        <div className="load-state"><div className="spinner" /><span>Loading…</span></div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Patient</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Description</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text3)' }}>No billing records found</td></tr>
              )}
              {filtered.map(b => (
                <tr key={b.id}>
                  <td><strong>#{b.id}</strong></td>
                  <td><span className="pid-pill">#{b.patientId}</span></td>
                  <td><span className="amount-col">LKR {Number(b.amount || 0).toLocaleString()}</span></td>
                  <td><StatusBadge status={b.paymentStatus} /></td>
                  <td><span className="no-wrap">{b.description || '—'}</span></td>
                  <td>
                    <div className="td-actions">
                      <button className="btn btn-amber btn-sm" onClick={() => { setEditData(b); setAddOpen(true); }}>✏</button>
                      <button className="btn btn-danger btn-sm" onClick={() => setDelId(b.id)}>🗑</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <BillFormModal open={addOpen} onClose={() => { setAddOpen(false); setEditData(null); }} editData={editData} onSaved={onReload} toast={toast} />
      <DeleteModal open={!!delId} onClose={() => setDelId(null)} title="Remove this bill?" message="This billing record will be permanently deleted." onConfirm={handleDelete} />
    </div>
  );
}

/* ══════════════════════════════════════════
   ROOT APP
══════════════════════════════════════════ */
const NAV = [
  { id: 'dashboard', label: 'Dashboard', icon: '⬡' },
  { id: 'patients', label: 'Patients', icon: '👥' },
  { id: 'appointments', label: 'Appointments', icon: '📅' },
  { id: 'billing', label: 'Billing', icon: '💰' },
];

export default function App() {
  const [page, setPage] = useState('dashboard');
  const [patients, setPatients] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [bills, setBills] = useState([]);
  const [loadingP, setLoadingP] = useState(true);
  const [loadingA, setLoadingA] = useState(true);
  const [loadingB, setLoadingB] = useState(true);
  const [viewPatient, setViewPatient] = useState(null);
  const { toasts, toast } = useToast();

  const loadP = useCallback(async () => {
    setLoadingP(true);
    try { setPatients(await http(PA)); }
    catch (e) { toast('Patient service: ' + e.message, 'err'); }
    finally { setLoadingP(false); }
  }, []);

  const loadA = useCallback(async () => {
    setLoadingA(true);
    try { setAppointments(await http(AA)); }
    catch (e) { toast('Appointment service: ' + e.message, 'err'); }
    finally { setLoadingA(false); }
  }, []);

  const loadB = useCallback(async () => {
    setLoadingB(true);
    try { setBills(await http(BA)); }
    catch (e) { toast('Billing service: ' + e.message, 'err'); }
    finally { setLoadingB(false); }
  }, []);

  useEffect(() => {
    loadP();
    loadA();
    loadB();
  }, []);

  const pageTitle = { dashboard: 'Dashboard', patients: 'Patients', appointments: 'Appointments', billing: 'Billing' };

  return (
    <div className="app-shell">
      {/* SIDEBAR */}
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="brand-hex">🏥</div>
          <div>
            <div className="brand-name">Smart<em>Clinic</em></div>
            <div className="brand-sub">Medical Management</div>
          </div>
        </div>

        <nav className="sidebar-nav">
          <div className="sidebar-section-label">Overview</div>
          {NAV.slice(0, 1).map(n => (
            <button key={n.id} className={`nav-item ${page === n.id ? 'nav-item--active' : ''}`} onClick={() => setPage(n.id)}>
              <span className="nav-icon">{n.icon}</span>
              <span>{n.label}</span>
            </button>
          ))}
          <div className="sidebar-section-label">Management</div>
          {NAV.slice(1).map(n => (
            <button key={n.id} className={`nav-item ${page === n.id ? 'nav-item--active' : ''}`} onClick={() => setPage(n.id)}>
              <span className="nav-icon">{n.icon}</span>
              <span>{n.label}</span>
              <span className="nav-badge">
                {n.id === 'patients' ? patients.length : n.id === 'appointments' ? appointments.length : bills.length}
              </span>
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="user-chip">
            <div className="user-av">A</div>
            <div>
              <div className="user-info-name">Admin User</div>
              <div className="user-info-role">System Administrator</div>
            </div>
          </div>
        </div>
      </aside>

      {/* MAIN */}
      <main className="main-content">
        <div className="topbar">
          <div className="topbar-title">{pageTitle[page]}</div>
          <div className="topbar-pills">
            <span className="tpill tpill-teal"><span className="live-dot" />Live</span>
            <span className="tpill tpill-amber">{BASE_URL.replace(/^https?:\/\//, '') || 'localhost:4173'}</span>
          </div>
        </div>

        {page === 'dashboard' && (
          <Dashboard
            patients={patients}
            appointments={appointments}
            bills={bills}
            onViewPatient={p => { setViewPatient(p); setPage('patients'); }}
            onNavTo={setPage}
          />
        )}
        {page === 'patients' && (
          <PatientsPage patients={patients} loading={loadingP} onReload={loadP} toast={toast} />
        )}
        {page === 'appointments' && (
          <AppointmentsPage appointments={appointments} loading={loadingA} onReload={loadA} toast={toast} />
        )}
        {page === 'billing' && (
          <BillingPage bills={bills} loading={loadingB} onReload={loadB} toast={toast} />
        )}
      </main>

      <Toasts toasts={toasts} />
    </div>
  );
}
