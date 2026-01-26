import React, { useState, useMemo, useEffect } from 'react';
import { Personnel, Settings } from '../types';
import { getFirstImageSource, buddhistToISO, isoToBuddhist } from '../utils';

interface ProfilePageProps {
    user: Personnel;
    onSave: (updatedUser: Personnel) => void;
    isSaving: boolean;
    settings: Settings;
}

const ProfilePage: React.FC<ProfilePageProps> = ({ user, onSave, isSaving, settings }) => {
    const [activeTab, setActiveTab] = useState<'info' | 'password'>('info');
    
    // Edit Info State
    const [formData, setFormData] = useState<Personnel>(user);
    const [previewImage, setPreviewImage] = useState<string | null>(null);

    // Change Password State
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [passError, setPassError] = useState('');
    
    // Password Visibility State
    const [showCurrentPass, setShowCurrentPass] = useState(false);
    const [showNewPass, setShowNewPass] = useState(false);
    const [showConfirmPass, setShowConfirmPass] = useState(false);
    
    useEffect(() => {
        setFormData(user);
    }, [user]);

    const profileImageUrl = useMemo(() => {
        if (previewImage) return previewImage;
        const file = Array.isArray(formData.profileImage) && formData.profileImage[0];
        if (file instanceof File) {
            return URL.createObjectURL(file);
        }
        return getFirstImageSource(formData.profileImage);
    }, [formData.profileImage, previewImage]);

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setFormData(prev => ({...prev, profileImage: [file]}));
            if (previewImage) URL.revokeObjectURL(previewImage);
            setPreviewImage(URL.createObjectURL(file));
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData(prev => ({ ...prev, [e.target.name]: isoToBuddhist(e.target.value) }));
    };

    const handleSaveInfo = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(formData);
    };

    const handleChangePassword = (e: React.FormEvent) => {
        e.preventDefault();
        setPassError('');

        const actualCurrentPass = user.password || user.idCard;

        if (currentPassword !== actualCurrentPass) {
            setPassError('รหัสผ่านปัจจุบันไม่ถูกต้อง');
            return;
        }
        if (newPassword.length < 4) {
            setPassError('รหัสผ่านใหม่ต้องมีความยาวอย่างน้อย 4 ตัวอักษร');
            return;
        }
        if (newPassword !== confirmPassword) {
            setPassError('รหัสผ่านใหม่ไม่ตรงกัน');
            return;
        }

        const updatedUser: Personnel = { ...formData, password: newPassword };
        onSave(updatedUser);
        
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        alert('เปลี่ยนรหัสผ่านเรียบร้อยแล้ว');
    };

    const ToggleButton: React.FC<{ show: boolean, setShow: (v: boolean) => void }> = ({ show, setShow }) => (
        <button type="button" onClick={() => setShow(!show)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-primary-blue">
             {show ? <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg> : <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>}
        </button>
    );

    return (
        <div className="max-w-5xl mx-auto">
            <div className="bg-white rounded-xl shadow-lg overflow-hidden border border-gray-100">
                <div className="p-6 bg-primary-blue text-white">
                    <h2 className="text-2xl font-bold">ข้อมูลส่วนตัว (My Profile)</h2>
                    <p className="text-blue-100">จัดการข้อมูลส่วนตัวและรหัสผ่านของคุณ</p>
                </div>
                
                <div className="flex border-b border-gray-200">
                    <button onClick={() => setActiveTab('info')} className={`flex-1 py-3 font-semibold transition-colors ${activeTab === 'info' ? 'text-primary-blue border-b-2 border-primary-blue' : 'text-gray-500'}`}>ข้อมูลทั่วไป</button>
                    <button onClick={() => setActiveTab('password')} className={`flex-1 py-3 font-semibold transition-colors ${activeTab === 'password' ? 'text-primary-blue border-b-2 border-primary-blue' : 'text-gray-500'}`}>เปลี่ยนรหัสผ่าน</button>
                </div>

                <div className="p-6">
                    {activeTab === 'info' && (
                        <form onSubmit={handleSaveInfo} className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="md:col-span-1 flex flex-col items-center">
                                <div className="w-40 h-40 rounded-full bg-gray-100 overflow-hidden border-4 border-white shadow-md mb-4">
                                    {profileImageUrl ? <img src={profileImageUrl} alt="Profile" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-gray-400">No Image</div>}
                                </div>
                                <label className="cursor-pointer bg-white border border-gray-300 rounded-md px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
                                    <span>เปลี่ยนรูปภาพ</span>
                                    <input type="file" className="sr-only" accept="image/*" onChange={handleImageChange} />
                                </label>
                            </div>
                            <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">คำนำหน้า</label>
                                    <select name="personnelTitle" value={formData.personnelTitle} onChange={handleChange} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm">
                                        <option>นาย</option><option>นาง</option><option>นางสาว</option><option value="อื่นๆ">อื่นๆ</option>
                                    </select>
                                </div>
                                <div className="sm:col-span-2">
                                    <label className="block text-sm font-medium text-gray-700">ชื่อ-นามสกุล</label>
                                    <input type="text" name="personnelName" value={formData.personnelName} onChange={handleChange} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">เบอร์โทรศัพท์</label>
                                    <input type="tel" name="phone" value={formData.phone} onChange={handleChange} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">อีเมล</label>
                                    <input type="email" name="email" value={formData.email} onChange={handleChange} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">ตำแหน่ง</label>
                                    <select name="position" value={formData.position} onChange={handleChange} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm">
                                        {settings.positions.map(p => <option key={p} value={p}>{p}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">วิทยฐานะ</label>
                                    <select name="academicStanding" value={formData.academicStanding || ''} onChange={handleChange} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm">
                                        <option value="">-- ไม่ระบุ --</option>
                                        {(settings.academicStandings || []).map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">วันเกิด</label>
                                    <input type="date" name="dob" value={buddhistToISO(formData.dob)} onChange={handleDateChange} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">วันที่บรรจุ</label>
                                    <input type="date" name="appointmentDate" value={buddhistToISO(formData.appointmentDate)} onChange={handleDateChange} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm" />
                                </div>
                                <div className="sm:col-span-2">
                                    <label className="block text-sm font-medium text-gray-500">เลขบัตรประชาชน</label>
                                    <input type="text" value={formData.idCard} readOnly disabled className="mt-1 block w-full bg-gray-100 border-gray-300 rounded-md shadow-sm" />
                                </div>
                            </div>
                            <div className="md:col-span-3 flex justify-end pt-4 border-t mt-4">
                                <button type="submit" disabled={isSaving} className="bg-primary-blue hover:bg-primary-hover text-white font-bold py-2 px-6 rounded-lg shadow-md disabled:opacity-50">
                                    {isSaving ? 'กำลังบันทึก...' : 'บันทึกข้อมูล'}
                                </button>
                            </div>
                        </form>
                    )}
                    {activeTab === 'password' && (
                        <form onSubmit={handleChangePassword} className="max-w-md mx-auto space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700">รหัสผ่านปัจจุบัน</label>
                                <div className="relative mt-1">
                                    <input type={showCurrentPass ? "text" : "password"} value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} required className="w-full border-gray-300 rounded-md shadow-sm pr-10" />
                                    <ToggleButton show={showCurrentPass} setShow={setShowCurrentPass} />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">รหัสผ่านใหม่</label>
                                <div className="relative mt-1">
                                    <input type={showNewPass ? "text" : "password"} value={newPassword} onChange={e => setNewPassword(e.target.value)} required className="w-full border-gray-300 rounded-md shadow-sm pr-10" />
                                    <ToggleButton show={showNewPass} setShow={setShowNewPass} />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">ยืนยันรหัสผ่านใหม่</label>
                                <div className="relative mt-1">
                                    <input type={showConfirmPass ? "text" : "password"} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required className="w-full border-gray-300 rounded-md shadow-sm pr-10" />
                                    <ToggleButton show={showConfirmPass} setShow={setShowConfirmPass} />
                                </div>
                            </div>
                            {passError && <p className="text-sm text-red-600">{passError}</p>}
                            <div className="flex justify-end pt-2">
                                <button type="submit" disabled={isSaving} className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-6 rounded-lg shadow-md disabled:opacity-50">
                                    {isSaving ? 'กำลังบันทึก...' : 'เปลี่ยนรหัสผ่าน'}
                                </button>
                            </div>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ProfilePage;
