import React, { useState, useEffect } from 'react';
import { Personnel } from '../types';
import { postToGoogleScript, prepareDataForApi } from '../utils';

interface RegisterModalProps {
    isOpen: boolean;
    onClose: () => void;
    onRegister: (personnel: Personnel) => void;
    positions: string[];
    isSaving: boolean;
    checkIdCardExists: (idCard: string) => Promise<boolean>;
}

const RegisterModal: React.FC<RegisterModalProps> = ({ isOpen, onClose, onRegister, positions, isSaving, checkIdCardExists }) => {
    const [formData, setFormData] = useState<Partial<Personnel>>({
        personnelTitle: 'นาย',
        personnelName: '',
        idCard: '',
        email: '',
        phone: '',
        position: positions[0] || '',
        role: 'user',
    });

    const [idStatus, setIdStatus] = useState<'idle' | 'checking' | 'exists' | 'available'>('idle');
    const [isIdVerified, setIsIdVerified] = useState(false);

    useEffect(() => {
        // Reset form when modal opens
        if (isOpen) {
            setFormData({
                personnelTitle: 'นาย',
                personnelName: '',
                idCard: '',
                email: '',
                phone: '',
                position: positions[0] || '',
            });
            setIdStatus('idle');
            setIsIdVerified(false);
        }
    }, [isOpen, positions]);

    const idCardInput = formData.idCard || '';

    useEffect(() => {
        if (idCardInput.length < 13) {
            setIdStatus('idle');
            setIsIdVerified(false);
            return;
        }

        setIdStatus('checking');
        const handler = setTimeout(async () => {
            try {
                const exists = await checkIdCardExists(idCardInput);
                if (exists) {
                    setIdStatus('exists');
                    setIsIdVerified(false);
                } else {
                    setIdStatus('available');
                    setIsIdVerified(true);
                }
            } catch (e) {
                console.error("Failed to check ID card:", e);
                setIdStatus('idle'); // Revert to idle on error
                setIsIdVerified(false);
            }
        }, 500);

        return () => clearTimeout(handler);
    }, [idCardInput, checkIdCardExists]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        
        if (name === 'idCard') {
            const numericValue = value.replace(/[^0-9]/g, '');
            setFormData(prev => ({ ...prev, idCard: numericValue }));
        } else {
            setFormData(prev => ({ ...prev, [name]: value }));
        }
    };

    const isFormValid = () => {
        return (
            isIdVerified &&
            (formData.personnelName || '').trim().length > 0 &&
            (formData.phone || '').trim().length >= 9 &&
            (formData.email || '').toLowerCase().endsWith('@gmail.com')
        );
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!isFormValid()) {
            alert('กรุณากรอกข้อมูลให้ครบถ้วนและถูกต้อง หรือรอการตรวจสอบเลขบัตรประชาชน');
            return;
        }

        const newPersonnel: Personnel = {
            ...formData as Personnel,
            id: Date.now(),
            dob: '', 
            appointmentDate: '', 
            positionNumber: '', 
            password: formData.idCard, 
            profileImage: [],
            role: 'user',
            status: 'pending',
            authProvider: 'manual',
            isEmailVerified: true // Set to true as we bypass OTP
        };

        onRegister(newPersonnel);
    };
    
    if (!isOpen) return null;

    const renderIdStatus = () => {
        switch (idStatus) {
            case 'checking':
                return <p className="text-xs text-blue-500 mt-1 animate-pulse">กำลังตรวจสอบ...</p>;
            case 'exists':
                return <p className="text-xs text-red-600 mt-1 font-bold">เลขบัตรประชาชนนี้มีอยู่ในระบบแล้ว หากท่านลืมรหัสผ่าน กรุณาติดต่อผู้ดูแลระบบ</p>;
            case 'available':
                return <p className="text-xs text-green-600 mt-1 font-bold">เลขบัตรประชาชนนี้สามารถใช้ได้ กรุณากรอกข้อมูลส่วนที่เหลือ</p>;
            case 'idle':
            default:
                return <p className="text-xs text-gray-400 mt-1">กรอกเลขบัตรประชาชน 13 หลักเพื่อตรวจสอบ</p>;
        }
    };

    return (
        <div className="fixed inset-0 bg-black/70 flex justify-center items-center z-[100] p-4 backdrop-blur-sm">
            <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden animate-fade-in-up border border-white/20">
                <div className="p-8 border-b bg-gray-50 flex justify-between items-center">
                    <div>
                        <h3 className="text-2xl font-bold text-navy">ลงทะเบียนบุคลากร</h3>
                        <p className="text-sm text-gray-400 mt-1">กรอกข้อมูลเพื่อขอสิทธิ์เข้าใช้งานระบบ</p>
                    </div>
                    <button onClick={onClose} className="text-gray-300 hover:text-gray-500 transition-colors text-3xl">&times;</button>
                </div>

                <form onSubmit={handleSubmit} className="p-8 space-y-6 overflow-y-auto">
                    <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">เลขบัตรประชาชน (ใช้เป็นรหัสผ่านเริ่มต้น)</label>
                        <input 
                            type="text" 
                            name="idCard" 
                            value={formData.idCard} 
                            onChange={handleChange} 
                            className={`w-full px-4 py-3.5 bg-gray-50 border rounded-2xl focus:bg-white transition-all font-mono tracking-[0.2em] outline-none ${
                                idStatus === 'exists' ? 'border-red-300 ring-2 ring-red-100' : 
                                idStatus === 'available' ? 'border-green-300 ring-2 ring-green-100' :
                                'border-gray-200 focus:ring-2 focus:ring-primary-blue'
                            }`}
                            maxLength={13} 
                            placeholder="146XXXXXXXXXX"
                            required 
                        />
                        {renderIdStatus()}
                    </div>

                    <fieldset disabled={!isIdVerified} className="space-y-4 transition-opacity duration-500 disabled:opacity-40 disabled:pointer-events-none">
                        <div className="border-t border-gray-100 pt-4 space-y-4">
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Gmail (สำหรับกู้คืนรหัสผ่าน)</label>
                                <input 
                                    type="email" 
                                    name="email" 
                                    value={formData.email} 
                                    onChange={handleChange} 
                                    className={`w-full px-4 py-3.5 border rounded-2xl outline-none transition-all ${
                                        formData.email && !formData.email.toLowerCase().endsWith('@gmail.com') ? 'bg-red-50 border-red-200' : 
                                        formData.email?.toLowerCase().endsWith('@gmail.com') ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 
                                        'bg-gray-50 border-gray-200 focus:bg-white'
                                    }`}
                                    placeholder="example@gmail.com" 
                                    required 
                                />
                                {formData.email && !formData.email.toLowerCase().endsWith('@gmail.com') && (
                                    <p className="text-[10px] text-red-500 font-bold ml-1">* ต้องเป็น @gmail.com เท่านั้น</p>
                                )}
                            </div>

                            <div className="grid grid-cols-3 gap-4">
                                <div className="col-span-1">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">คำนำหน้า</label>
                                    <select name="personnelTitle" value={formData.personnelTitle} onChange={handleChange} className="w-full px-4 py-3.5 bg-gray-50 border border-gray-200 rounded-2xl text-sm font-bold">
                                        <option value="นาย">นาย</option>
                                        <option value="นาง">นาง</option>
                                        <option value="นางสาว">นางสาว</option>
                                    </select>
                                </div>
                                <div className="col-span-2">
                                     <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">ชื่อ-นามสกุล</label>
                                    <input type="text" name="personnelName" value={formData.personnelName} onChange={handleChange} className="w-full px-4 py-3.5 bg-gray-50 border border-gray-200 rounded-2xl text-sm font-bold" placeholder="ระบุชื่อและนามสกุล" required />
                                </div>
                            </div>

                            <div>
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">ตำแหน่ง</label>
                                <select name="position" value={formData.position} onChange={handleChange} className="w-full px-4 py-3.5 bg-gray-50 border border-gray-200 rounded-2xl text-sm font-bold" required>
                                    {positions.map(p => <option key={p} value={p}>{p}</option>)}
                                </select>
                            </div>

                            <div>
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">เบอร์โทรศัพท์</label>
                                <input type="tel" name="phone" value={formData.phone} onChange={handleChange} className="w-full px-4 py-3.5 bg-gray-50 border border-gray-200 rounded-2xl text-sm font-bold" placeholder="0XXXXXXXXX" required />
                            </div>
                        </div>
                    </fieldset>
                    
                    <div className="flex gap-3 pt-4 border-t border-gray-100">
                        <button type="button" onClick={onClose} className="flex-1 bg-gray-50 py-4 rounded-2xl font-bold text-gray-400 hover:bg-gray-100 transition-colors">ยกเลิก</button>
                        <button 
                            type="submit" 
                            disabled={isSaving || !isFormValid()} 
                            className="flex-1 bg-navy hover:bg-blue-900 text-white py-4 rounded-2xl font-bold shadow-xl shadow-blue-900/10 transition-all active:scale-95 disabled:opacity-40 disabled:grayscale"
                        >
                            {isSaving ? 'กำลังบันทึก...' : 'ลงทะเบียน'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default RegisterModal;
