import { useState, useEffect, useRef } from 'react';
import { Users, UserPlus, Search, Mail, Briefcase, Calendar, Edit2, Trash2, Download, Upload, FileSpreadsheet, AlertCircle, X, Clock, Award, Shield, Activity, AlertTriangle, TrendingUp, MessageSquare, Send, ChevronDown, Maximize2, Minimize2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts';
import * as XLSX from 'xlsx';
import MRSCard from './MRSCard';
import MRSStatCard from './MRSStatCard';
import { db } from '../../lib/firebase';
import { collection, getDocs, query, orderBy, deleteDoc, doc, addDoc, updateDoc, where } from 'firebase/firestore';
import { formatDate, formatNumber, getCurrentMonth } from '../../lib/format';
import { exportToXLSX, ExportData } from '../../lib/exportUtils';
import { calculateIntelligentRanking, RankingResult } from '../../lib/rankingEngine';

interface Employee {
  id: string;
  name: string;
  email: string;
  department: string;
  position: string;
  hire_date: string;
  active: boolean;
  photo_url: string | null;
}

export default function Colaboradores() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [filteredEmployees, setFilteredEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all');
  const [departments, setDepartments] = useState<string[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadEmployees();
  }, []);

  useEffect(() => {
    filterEmployees();
  }, [searchTerm, selectedDepartment, employees]);

  const loadEmployees = async () => {
    setLoading(true);
    try {
      const employeesQuery = query(collection(db, 'employees'), orderBy('name'));
      const querySnapshot = await getDocs(employeesQuery);

      if (!querySnapshot.empty) {
        const data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Employee[];
        setEmployees(data);
        const depts = [...new Set(data.map(e => e.department))];
        setDepartments(depts);
      }
    } catch (error) {
      console.error('Erro ao carregar colaboradores:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterEmployees = () => {
    let filtered = employees;

    if (searchTerm) {
      filtered = filtered.filter(e =>
        e.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        e.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        e.position.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (selectedDepartment !== 'all') {
      filtered = filtered.filter(e => e.department === selectedDepartment);
    }

    setFilteredEmployees(filtered);
  };

  const handleDeleteEmployee = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este colaborador?')) return;

    try {
      await deleteDoc(doc(db, 'employees', id));
      await loadEmployees();
      alert('Colaborador excluído com sucesso!');
    } catch (error) {
      console.error('Erro ao excluir colaborador:', error);
      alert('Erro ao excluir colaborador');
    }
  };

  const handleExportXLSX = () => {
    const data: ExportData = {
      title: 'Colaboradores',
      headers: ['Nome', 'Email', 'Departamento', 'Cargo', 'Data de Admissão', 'Status'],
      rows: filteredEmployees.map(e => [
        e.name,
        e.email,
        e.department,
        e.position,
        e.hire_date ? formatDate(e.hire_date) : 'N/A',
        e.active ? 'Ativo' : 'Inativo'
      ]),
      filename: 'colaboradores_mrs'
    };

    exportToXLSX(data);
  };

  const handleDownloadTemplate = () => {
    const templateData: ExportData = {
      title: 'Template',
      headers: ['nome', 'email', 'departamento', 'cargo', 'data_admissao', 'ativo', 'foto_url'],
      rows: [
        ['João Silva', 'joao.silva@empresa.com', 'Operacional', 'Operador', '2024-01-15', 'true', ''],
        ['Maria Santos', 'maria.santos@empresa.com', 'Administrativo', 'Assistente', '2024-02-20', 'true', ''],
      ],
      filename: 'template_colaboradores_mrs'
    };

    exportToXLSX(templateData);
  };

  const handleImportFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      setShowImportModal(true);
      processImportData(jsonData);
    } catch (error) {
      console.error('Erro ao ler arquivo:', error);
      alert('Erro ao ler arquivo. Verifique o formato.');
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const processImportData = async (data: any[]) => {
    let successCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    for (const row of data) {
      try {
        const employeeData = {
          name: row.nome || row.Name || row.NOME,
          email: row.email || row.Email || row.EMAIL,
          department: row.departamento || row.Department || row.DEPARTAMENTO || 'Operacional',
          position: row.cargo || row.Position || row.CARGO || 'Colaborador',
          hire_date: parseDate(row.data_admissao || row.hire_date || row.DATA_ADMISSAO) || new Date().toISOString().split('T')[0],
          active: parseBoolean(row.ativo || row.active || row.ATIVO),
          photo_url: row.foto_url || row.photo_url || row.FOTO_URL || '',
        };

        if (!employeeData.name || !employeeData.email) {
          errorCount++;
          errors.push(`Linha com dados incompletos: ${JSON.stringify(row)}`);
          continue;
        }

        try {
          await addDoc(collection(db, 'employees'), employeeData);
          successCount++;
        } catch (dbError) {
          errorCount++;
          const errorMessage = dbError instanceof Error ? dbError.message : String(dbError);
          errors.push(`Erro ao salvar ${employeeData.name}: ${errorMessage}`);
        }
      } catch (error) {
        errorCount++;
        errors.push(`Erro ao processar linha: ${JSON.stringify(row)}`);
      }
    }

    await loadEmployees();
    setShowImportModal(false);

    let message = `Importação concluída!\n\n`;
    message += `✅ ${successCount} colaborador(es) importado(s) com sucesso\n`;
    if (errorCount > 0) {
      message += `❌ ${errorCount} erro(s)\n\n`;
      message += `Erros:\n${errors.slice(0, 5).join('\n')}`;
      if (errors.length > 5) {
        message += `\n... e mais ${errors.length - 5} erro(s)`;
      }
    }

    alert(message);
  };

  const parseDate = (dateStr: any): string | null => {
    if (!dateStr) return null;

    if (typeof dateStr === 'number') {
      const date = XLSX.SSF.parse_date_code(dateStr);
      return `${date.y}-${String(date.m).padStart(2, '0')}-${String(date.d).padStart(2, '0')}`;
    }

    const str = String(dateStr);

    if (str.match(/^\d{4}-\d{2}-\d{2}$/)) {
      return str;
    }

    if (str.match(/^\d{2}\/\d{2}\/\d{4}$/)) {
      const [day, month, year] = str.split('/');
      return `${year}-${month}-${day}`;
    }

    return null;
  };

  const parseBoolean = (value: any): boolean => {
    if (typeof value === 'boolean') return value;
    const str = String(value).toLowerCase();
    return str === 'true' || str === 'sim' || str === 'yes' || str === '1' || str === 'ativo';
  };

  const stats = {
    total: employees.length,
    active: employees.filter(e => e.active).length,
    inactive: employees.filter(e => !e.active).length,
    departments: departments.length
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-[#912325] mx-auto"></div>
          <p className="text-gray-600 mt-4 font-medium">Carregando colaboradores...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#912325] flex items-center gap-3">
            <Users className="w-8 h-8 text-[#f97316]" />
            Gestão de Colaboradores
          </h1>
          <p className="text-gray-600 mt-1">Cadastro e gerenciamento da equipe</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 bg-gradient-to-r from-[#912325] to-[#701a1c] text-white rounded-lg hover:shadow-lg transition-all flex items-center gap-2 font-semibold"
          >
            <UserPlus className="w-5 h-5" />
            Novo
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleImportFile}
            className="hidden"
          />

          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-emerald-700 text-white rounded-lg hover:shadow-lg transition-all flex items-center gap-2 font-semibold"
          >
            <Upload className="w-5 h-5" />
            Importar
          </button>

          <button
            onClick={handleDownloadTemplate}
            className="px-4 py-2 bg-gradient-to-r from-violet-600 to-violet-700 text-white rounded-lg hover:shadow-lg transition-all flex items-center gap-2 font-semibold"
          >
            <FileSpreadsheet className="w-5 h-5" />
            Template
          </button>

          <button
            onClick={handleExportXLSX}
            className="px-4 py-2 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-lg hover:shadow-lg transition-all flex items-center gap-2 font-semibold"
          >
            <Download className="w-5 h-5" />
            Exportar
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <MRSStatCard
          title="Total de Colaboradores"
          value={stats.total}
          icon={<Users className="w-7 h-7" />}
          colorClass="from-[#912325] to-[#701a1c]"
        />
        <MRSStatCard
          title="Colaboradores Ativos"
          value={stats.active}
          icon={<Users className="w-7 h-7" />}
          colorClass="from-emerald-600 to-emerald-700"
        />
        <MRSStatCard
          title="Colaboradores Inativos"
          value={stats.inactive}
          icon={<Users className="w-7 h-7" />}
          colorClass="from-gray-600 to-gray-700"
        />
        <MRSStatCard
          title="Departamentos"
          value={stats.departments}
          icon={<Briefcase className="w-7 h-7" />}
          colorClass="from-[#f97316] to-[#fb923c]"
        />
      </div>

      <MRSCard icon={AlertCircle} title="Importação em Lote" collapsible defaultOpen={false}>
        <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-lg">
          <h4 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5" />
            Como importar colaboradores em lote
          </h4>
          <ol className="space-y-2 text-sm text-blue-800">
            <li className="flex gap-2">
              <span className="font-bold">1.</span>
              <span>Clique em <strong>"Template"</strong> para baixar o modelo de planilha com exemplos</span>
            </li>
            <li className="flex gap-2">
              <span className="font-bold">2.</span>
              <span>Preencha a planilha com os dados dos colaboradores seguindo o formato do exemplo</span>
            </li>
            <li className="flex gap-2">
              <span className="font-bold">3.</span>
              <span>Clique em <strong>"Importar"</strong> e selecione o arquivo preenchido (.xlsx ou .xls)</span>
            </li>
            <li className="flex gap-2">
              <span className="font-bold">4.</span>
              <span>Aguarde o processamento - você receberá um relatório com sucesso e erros</span>
            </li>
          </ol>
          <div className="mt-4 p-3 bg-white rounded border border-blue-200">
            <p className="text-xs font-semibold text-blue-900 mb-2">Colunas aceitas na planilha:</p>
            <code className="text-xs text-blue-700 block">
              nome | email | departamento | cargo | data_admissao | ativo | foto_url
            </code>
            <p className="text-xs text-blue-600 mt-2">
              <strong>Formato de data:</strong> AAAA-MM-DD ou DD/MM/AAAA | <strong>Status:</strong> true/false, sim/não, ativo/inativo
            </p>
            <p className="text-xs text-blue-600 mt-1">
              <strong>Foto:</strong> Deixe em branco ou adicione URL pública da imagem
            </p>
          </div>
        </div>
      </MRSCard>

      <MRSCard>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Buscar por nome, email ou cargo..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#912325] focus:border-transparent"
            />
          </div>
          <select
            value={selectedDepartment}
            onChange={(e) => setSelectedDepartment(e.target.value)}
            className="px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#912325] focus:border-transparent"
          >
            <option value="all">Todos os Departamentos</option>
            {departments.map(dept => (
              <option key={dept} value={dept}>{dept}</option>
            ))}
          </select>
        </div>

        <div className="space-y-3">
          {filteredEmployees.map((employee, index) => (
            <motion.div
              key={employee.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.03 }}
              className="flex items-center gap-4 p-4 bg-gradient-to-r from-gray-50 to-white rounded-xl border border-gray-200 hover:border-[#f97316] hover:shadow-md transition-all duration-300 cursor-pointer"
              onClick={() => setSelectedEmployee(employee)}
            >
              {employee.photo_url ? (
                <img
                  src={employee.photo_url}
                  alt={employee.name}
                  className="w-14 h-14 rounded-full object-cover shadow-lg border-2 border-white"
                />
              ) : (
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#912325] to-[#701a1c] flex items-center justify-center text-white font-bold text-xl shadow-lg">
                  {employee.name.charAt(0).toUpperCase()}
                </div>
              )}

              <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <h4 className="font-bold text-lg text-[#912325]">{employee.name}</h4>
                  <div className="flex items-center gap-1 text-sm text-gray-600 mt-1">
                    <Mail className="w-4 h-4" />
                    {employee.email}
                  </div>
                </div>

                <div>
                  <p className="text-sm text-gray-500">Cargo</p>
                  <div className="flex items-center gap-1 text-sm font-medium text-gray-900 mt-1">
                    <Briefcase className="w-4 h-4 text-[#f97316]" />
                    {employee.position}
                  </div>
                </div>

                <div>
                  <p className="text-sm text-gray-500">Departamento</p>
                  <p className="text-sm font-medium text-gray-900 mt-1">{employee.department}</p>
                </div>

                <div>
                  <p className="text-sm text-gray-500">Admissão</p>
                  <div className="flex items-center gap-1 text-sm font-medium text-gray-900 mt-1">
                    <Calendar className="w-4 h-4 text-[#f97316]" />
                    {formatDate(employee.hire_date)}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                  employee.active
                    ? 'bg-green-100 text-green-700'
                    : 'bg-gray-100 text-gray-700'
                }`}>
                  {employee.active ? 'Ativo' : 'Inativo'}
                </span>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingEmployee(employee);
                  }}
                  className="p-2 text-[#912325] hover:bg-red-50 rounded-lg transition-colors"
                  title="Editar"
                >
                  <Edit2 className="w-4 h-4" />
                </button>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteEmployee(employee.id);
                  }}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  title="Excluir"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          ))}

          {filteredEmployees.length === 0 && (
            <div className="text-center py-12">
              <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600">Nenhum colaborador encontrado</p>
              <button
                onClick={() => setShowAddModal(true)}
                className="mt-4 px-4 py-2 bg-[#912325] text-white rounded-lg hover:bg-[#701a1c] transition-colors"
              >
                Adicionar Primeiro Colaborador
              </button>
            </div>
          )}
        </div>
      </MRSCard>

      {showAddModal && (
        <EmployeeModal
          onClose={() => setShowAddModal(false)}
          onSave={() => {
            setShowAddModal(false);
            loadEmployees();
          }}
        />
      )}

      {editingEmployee && (
        <EmployeeModal
          employee={editingEmployee}
          onClose={() => setEditingEmployee(null)}
          onSave={() => {
            setEditingEmployee(null);
            loadEmployees();
          }}
        />
      )}

      {showImportModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl p-8 max-w-md w-full mx-4">
            <div className="text-center">
              <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-[#912325] mx-auto mb-4"></div>
              <h3 className="text-xl font-bold text-[#912325] mb-2">Importando Colaboradores</h3>
              <p className="text-gray-600">Processando arquivo, aguarde...</p>
            </div>
          </div>
        </div>
      )}

      {selectedEmployee && (
        <EmployeeDetailsModal
          employee={selectedEmployee}
          onClose={() => setSelectedEmployee(null)}
        />
      )}
    </div>
  );
}

interface EmployeeModalProps {
  employee?: Employee;
  onClose: () => void;
  onSave: () => void;
}

function EmployeeModal({ employee, onClose, onSave }: EmployeeModalProps) {
  const [formData, setFormData] = useState({
    name: employee?.name || '',
    email: employee?.email || '',
    department: employee?.department || 'Operacional',
    position: employee?.position || '',
    hire_date: employee?.hire_date || new Date().toISOString().split('T')[0],
    active: employee?.active ?? true,
    photo_url: employee?.photo_url || '',
  });
  const [photoPreview, setPhotoPreview] = useState<string>(employee?.photo_url || '');
  const [saving, setSaving] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      alert('A imagem deve ter no máximo 2MB');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      setPhotoPreview(result);
      setFormData({ ...formData, photo_url: result });
    };
    reader.readAsDataURL(file);
  };

  const handleRemovePhoto = () => {
    setPhotoPreview('');
    setFormData({ ...formData, photo_url: '' });
    if (photoInputRef.current) {
      photoInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      if (employee) {
        const employeeRef = doc(db, 'employees', employee.id);
        await updateDoc(employeeRef, formData);
        alert('Colaborador atualizado com sucesso!');
      } else {
        await addDoc(collection(db, 'employees'), formData);
        alert('Colaborador adicionado com sucesso!');
      }

      onSave();
    } catch (error) {
      console.error('Erro ao salvar colaborador:', error);
      alert('Erro ao salvar colaborador');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
      >
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-[#912325]">
            {employee ? 'Editar Colaborador' : 'Novo Colaborador'}
          </h2>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Foto do Colaborador</label>
            <div className="flex items-center gap-4">
              <div className="relative">
                {photoPreview ? (
                  <img
                    src={photoPreview}
                    alt="Preview"
                    className="w-24 h-24 rounded-full object-cover border-4 border-gray-200"
                  />
                ) : (
                  <div className="w-24 h-24 rounded-full bg-gradient-to-br from-[#912325] to-[#701a1c] flex items-center justify-center text-white font-bold text-3xl border-4 border-gray-200">
                    {formData.name ? formData.name.charAt(0).toUpperCase() : '?'}
                  </div>
                )}
              </div>
              <div className="flex-1 space-y-2">
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoChange}
                  className="hidden"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => photoInputRef.current?.click()}
                    className="px-4 py-2 bg-gradient-to-r from-[#912325] to-[#701a1c] text-white rounded-lg hover:shadow-lg transition-all text-sm font-medium"
                  >
                    {photoPreview ? 'Alterar Foto' : 'Adicionar Foto'}
                  </button>
                  {photoPreview && (
                    <button
                      type="button"
                      onClick={handleRemovePhoto}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium"
                    >
                      Remover
                    </button>
                  )}
                </div>
                <p className="text-xs text-gray-500">JPG, PNG ou GIF (máx. 2MB)</p>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Nome Completo</label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#912325]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
            <input
              type="email"
              required
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#912325]"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Departamento</label>
              <select
                value={formData.department}
                onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#912325]"
              >
                <option value="Operacional">Operacional</option>
                <option value="Administrativo">Administrativo</option>
                <option value="Comercial">Comercial</option>
                <option value="TI">TI</option>
                <option value="RH">RH</option>
                <option value="Financeiro">Financeiro</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Cargo</label>
              <input
                type="text"
                required
                value={formData.position}
                onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#912325]"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Data de Admissão</label>
              <input
                type="date"
                required
                value={formData.hire_date}
                onChange={(e) => setFormData({ ...formData, hire_date: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#912325]"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
              <select
                value={formData.active ? 'true' : 'false'}
                onChange={(e) => setFormData({ ...formData, active: e.target.value === 'true' })}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#912325]"
              >
                <option value="true">Ativo</option>
                <option value="false">Inativo</option>
              </select>
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-4 py-2.5 bg-gradient-to-r from-[#912325] to-[#701a1c] text-white rounded-lg hover:shadow-lg transition-all disabled:opacity-50 font-semibold"
            >
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

interface EmployeeDetailsModalProps {
  employee: Employee;
  onClose: () => void;
}

function EmployeeDetailsModal({ employee, onClose }: EmployeeDetailsModalProps) {
  const [trainings, setTrainings] = useState<any[]>([]);
  const [exams, setExams] = useState<any[]>([]);
  const [absences, setAbsences] = useState<any[]>([]);
  const [comments, setComments] = useState<any[]>([]);
  const [rankings, setRankings] = useState<any[]>([]);
  const [employeeRanking, setEmployeeRanking] = useState<RankingResult | null>(null);
  const [absencesDelaysEvolution, setAbsencesDelaysEvolution] = useState<Array<{ month: string; Faltas: number; Atrasos: number }>>([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [commentAuthor, setCommentAuthor] = useState('');
  const [savingComment, setSavingComment] = useState(false);
  const contentScrollRef = useRef<HTMLDivElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  const [expandedSections, setExpandedSections] = useState({
    absencesEvolution: true,
    evolution: true,
    performance: true,
    exams: true,
    trainings: true,
    comments: true
  });
  const [isFullScreen, setIsFullScreen] = useState(false);

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  useEffect(() => {
    loadEmployeeDetails();

    // Auto-ajuste de scroll ao abrir o modal
    if (modalRef.current) {
      modalRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [employee.id]);

  // Scroll content to top when modal goes full screen
  useEffect(() => {
    if (isFullScreen && contentScrollRef.current) {
      contentScrollRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }

  }, [employee.id]);

  const loadEmployeeDetails = async () => {
    setLoading(true);
    try {
      // Buscar dados básicos
      const [trainingsSnapshot, examsSnapshot, absencesSnapshot, commentsSnapshot, rankingsSnapshot] = await Promise.all([
        getDocs(query(collection(db, 'sst_trainings'), where('employee_id', '==', employee.id))),
        getDocs(query(collection(db, 'sst_medical_exams'), where('employee_id', '==', employee.id))),
        getDocs(query(collection(db, 'attendance_records'), where('employee_id', '==', employee.id), where('status', '==', 'absent'))),
        getDocs(query(collection(db, 'employee_comments'), where('employee_id', '==', employee.id))),
        getDocs(query(collection(db, 'employee_rankings'), where('employee_id', '==', employee.id)))
      ]);

      setTrainings(trainingsSnapshot.docs.map(doc => doc.data()));
      setExams(examsSnapshot.docs.map(doc => doc.data()));
      setAbsences(absencesSnapshot.docs.map(doc => doc.data()));
      setComments(commentsSnapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      );

      if (!rankingsSnapshot.empty) {
        setRankings(rankingsSnapshot.docs
          .map(doc => doc.data())
          .sort((a: any, b: any) => a.period.localeCompare(b.period))
        );
      }

      // Buscar dados do ranking consolidado (todos os períodos) - SOMA TOTAL = 283.1
      const allRankingsSnapshot = await getDocs(query(collection(db, 'employee_rankings'), where('employee_id', '==', employee.id)));
      const allRankingsData = allRankingsSnapshot.docs.map(doc => doc.data());

      if (allRankingsData.length > 0) {
        // SOMA de todos os períodos (igual ao filtro "Todos os períodos" do Ranking)
        const consolidatedScore = allRankingsData.reduce((sum, r) => {
          const score = parseFloat(String(r.total_score));
          return sum + (isNaN(score) ? 0 : score);
        }, 0);

        // Buscar scores para calcular detalhes por critério
        const allScoresSnapshot = await getDocs(query(collection(db, 'employee_scores'), where('employee_id', '==', employee.id)));
        const criteriaSnapshot = await getDocs(query(collection(db, 'evaluation_criteria'), where('active', '==', true)));

        if (!allScoresSnapshot.empty && !criteriaSnapshot.empty) {
          const allScores = allScoresSnapshot.docs.map(doc => doc.data());
          const criteriaData = criteriaSnapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() }))
            .sort((a: any, b: any) => (a.display_order || 0) - (b.display_order || 0));

          // Calcular pontuação por critério (SOMA de todos os períodos)
          const criterionScores = criteriaData.map(criterion => {
            // Buscar scores de TODOS os períodos para este critério
            const criterionScores = allScores.filter(s => s.criterion_id === criterion.id);

            if (criterionScores.length === 0) {
              return {
                criterion_id: criterion.id,
                criterion_name: criterion.name,
                raw_value: 0,
                normalized_score: 0,
                weight: criterion.weight,
                weighted_score: 0
              };
            }

            // SOMA dos weighted_scores de todos os períodos
            const totalWeightedScore = criterionScores.reduce((sum, s) => {
              const normalized = parseFloat(String(s.normalized_score));
              const weightedScore = (normalized * criterion.weight) / 100;
              return sum + (isNaN(weightedScore) ? 0 : weightedScore);
            }, 0);

            // Média normalized_score para o radar
            const avgNormalizedScore = criterionScores.reduce((sum, s) => {
              const normalized = parseFloat(String(s.normalized_score));
              return sum + (isNaN(normalized) ? 0 : normalized);
            }, 0) / criterionScores.length;

            return {
              criterion_id: criterion.id,
              criterion_name: criterion.name,
              raw_value: 0,
              normalized_score: Math.round(avgNormalizedScore * 100) / 100,
              weight: criterion.weight,
              weighted_score: Math.round(totalWeightedScore * 100) / 100
            };
          });

          // Calcular faltas e atrasos acumulados
          const assiduityScores = allScores.filter(s =>
            criteriaData.find(c => c.id === s.criterion_id && c.name === 'Assiduidade')
          );
          const punctualityScores = allScores.filter(s =>
            criteriaData.find(c => c.id === s.criterion_id && c.name === 'Pontualidade')
          );

          let absencesCount = 0;
          let lateCount = 0;

          assiduityScores.forEach(s => {
            const assiduity = parseFloat(String(s.raw_value));
            if (!isNaN(assiduity) && assiduity >= 0 && assiduity <= 100) {
              absencesCount += Math.round((100 - assiduity) / 5);
            }
          });

          punctualityScores.forEach(s => {
            const punctuality = parseFloat(String(s.raw_value));
            if (!isNaN(punctuality) && punctuality >= 0) {
              lateCount += Math.round(punctuality);
            }
          });

          const strengths = criterionScores
            .filter(cs => cs.normalized_score >= 80)
            .map(cs => `${cs.criterion_name}: ${cs.normalized_score.toFixed(1)}%`);

          const suggestions = criterionScores
            .filter(cs => cs.normalized_score < 60)
            .map(cs => `Melhorar ${cs.criterion_name} (atual: ${cs.normalized_score.toFixed(1)}%)`);

          setEmployeeRanking({
            employee_id: employee.id,
            employee_name: employee.name,
            period: 'Todos os Períodos',
            total_score: Math.round(consolidatedScore * 100) / 100,
            rank_position: 0,
            criterion_scores: criterionScores,
            strengths: strengths.length > 0 ? strengths : ['Colaborador tem performance estável'],
            suggestions: suggestions.length > 0 ? suggestions : ['Manter o bom desempenho atual'],
            absences_count: absencesCount,
            late_count: lateCount
          });

          console.log('✅ Ranking consolidado (SOMA de todos os períodos):', {
            consolidatedScore: Math.round(consolidatedScore * 100) / 100,
            periodsCount: allRankingsData.length,
            absencesCount,
            lateCount,
            criterionScores
          });

          // Calcular evolução de faltas e atrasos
          const evolutionScoresByMonth: { [month: string]: { absences: number; delays: number } } = {};
          allScores.forEach(score => {
            const period = score.period.substring(0, 7); // YYYY-MM
            if (!evolutionScoresByMonth[period]) {
              evolutionScoresByMonth[period] = { absences: 0, delays: 0 };
            }

            if (criteriaData.find(c => c.id === score.criterion_id && c.name === 'Assiduidade')) {
              const assiduity = parseFloat(String(score.raw_value));
              if (!isNaN(assiduity)) {
                evolutionScoresByMonth[period].absences += Math.round((100 - assiduity) / 5);
              }
            } else if (criteriaData.find(c => c.id === score.criterion_id && c.name === 'Pontualidade')) {
              const punctuality = parseFloat(String(score.raw_value));
              if (!isNaN(punctuality)) {
                evolutionScoresByMonth[period].delays += Math.round(punctuality);
              }
            }
          });

          const evolutionChartData = Object.keys(evolutionScoresByMonth).sort().map(month => {
            const [year, monthNum] = month.split('-');
            const monthName = new Date(parseInt(year), parseInt(monthNum) - 1, 1).toLocaleString('pt-BR', { month: 'short' });
            return { month: `${monthName}/${year.slice(2)}`, Faltas: evolutionScoresByMonth[month].absences, Atrasos: evolutionScoresByMonth[month].delays };
          });

          setAbsencesDelaysEvolution(evolutionChartData);
        }
      } else {
        console.log('❌ Sem dados de ranking para o colaborador');
        setEmployeeRanking(null);
      }
    } catch (error) {
      console.error('Erro ao carregar detalhes:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateTimeInCompany = () => {
    const hireDate = new Date(employee.hire_date);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - hireDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    const years = Math.floor(diffDays / 365);
    const months = Math.floor((diffDays % 365) / 30);

    if (years > 0) {
      return `${years} ano${years > 1 ? 's' : ''} e ${months} ${months === 1 ? 'mês' : 'meses'}`;
    }
    return `${months} ${months === 1 ? 'mês' : 'meses'}`;
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { bg: string; text: string; label: string }> = {
      valid: { bg: 'bg-green-100', text: 'text-green-700', label: 'Válido' },
      expired: { bg: 'bg-red-100', text: 'text-red-700', label: 'Expirado' },
      pending: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Pendente' },
      scheduled: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Agendado' },
    };

    const config = statusConfig[status] || { bg: 'bg-gray-100', text: 'text-gray-700', label: status };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${config.bg} ${config.text}`}>
        {config.label}
      </span>
    );
  };

  const handleAddComment = async () => {
    if (!newComment.trim()) {
      alert('Digite um comentário');
      return;
    }

    setSavingComment(true);
    try {
      await addDoc(collection(db, 'employee_comments'), {
        employee_id: employee.id,
        comment: newComment,
        created_by: commentAuthor.trim() || 'Anônimo',
        created_at: new Date().toISOString(),
      });

      setNewComment('');
      setCommentAuthor('');

      await loadEmployeeDetails();
    } catch (error) {
      console.error('Erro ao adicionar comentário:', error);
      alert('Erro ao adicionar comentário');
    } finally {
      setSavingComment(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!confirm('Tem certeza que deseja excluir este comentário?')) return;

    try {
      await deleteDoc(doc(db, 'employee_comments', commentId));
      await loadEmployeeDetails();
    } catch (error) {
      console.error('Erro ao excluir comentário:', error);
      alert('Erro ao excluir comentário');
    }
  };

  const getRankingChartData = () => {
    // Usar Map para remover duplicatas baseado no período
    const uniqueRankings = new Map();

    rankings.forEach((rank) => {
      const [year, month] = rank.period.split('-');
      const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
      const periodKey = `${monthNames[parseInt(month) - 1]}/${year}`;

      // Apenas adiciona se não existir (mantém o primeiro registro)
      if (!uniqueRankings.has(periodKey)) {
        uniqueRankings.set(periodKey, {
          period: periodKey,
          posicao: rank.rank_position,
          pontuacao: rank.total_score
        });
      }
    });

    return Array.from(uniqueRankings.values());
  };

  return (
    <div ref={modalRef} className={`fixed inset-0 bg-black/50 flex items-center justify-center z-50 ${isFullScreen ? 'p-0' : 'p-4'}`}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className={`bg-white shadow-2xl w-full flex flex-col transition-all ${
          isFullScreen
            ? 'h-full max-w-full rounded-none'
            : 'max-w-5xl max-h-[90vh] rounded-xl'
        }`}
      >
        <div className={`flex-shrink-0 bg-gradient-to-r from-[#912325] to-[#701a1c] text-white p-6 flex items-start justify-between z-10 ${
          isFullScreen ? 'rounded-none' : 'rounded-t-xl'
        }`}>
          <div className="flex items-center gap-6 flex-1">
            {employee.photo_url ? (
              <img
                src={employee.photo_url}
                alt={employee.name}
                className="w-24 h-24 rounded-full object-cover shadow-xl border-4 border-white"
              />
            ) : (
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-[#f97316] to-[#fb923c] flex items-center justify-center text-white font-bold text-4xl shadow-xl border-4 border-white">
                {employee.name.charAt(0).toUpperCase()}
              </div>
            )}
            <div>
              <h2 className="text-3xl font-bold mb-2">{employee.name}</h2>
              <div className="flex items-center gap-2 text-white/90 mb-1">
                <Mail className="w-4 h-4" />
                <span className="text-sm">{employee.email}</span>
              </div>
              <div className="flex items-center gap-2 text-white/90">
                <Briefcase className="w-4 h-4" />
                <span className="text-sm">{employee.position} • {employee.department}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsFullScreen(!isFullScreen)}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              title={isFullScreen ? 'Restaurar tamanho' : 'Expandir tela cheia'}
            >
              {isFullScreen ? (
                <Minimize2 className="w-6 h-6" />
              ) : (
                <Maximize2 className="w-6 h-6" />
              )}
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              title="Fechar"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-gradient-to-br from-gray-50 to-gray-100 p-5 rounded-xl border border-gray-200">
              <div className="flex items-center gap-3 mb-2">
                <Clock className="w-6 h-6 text-gray-600" />
                <h3 className="font-semibold text-gray-900">Tempo de Casa</h3>
              </div>
              <p className="text-2xl font-bold text-gray-700">{calculateTimeInCompany()}</p>
              <p className="text-xs text-gray-600 mt-1">Desde {formatDate(employee.hire_date)}</p>
            </div>

            <div className="bg-gradient-to-br from-red-50 to-red-100 p-5 rounded-xl border border-red-200">
              <div className="flex items-center gap-3 mb-2">
                <AlertTriangle className="w-6 h-6 text-red-600" />
                <h3 className="font-semibold text-red-900">Faltas</h3>
              </div>
              <p className="text-2xl font-bold text-red-700">
                {employeeRanking?.absences_count ?? 0}
              </p>
              <p className="text-xs text-red-600 mt-1">Total registrado</p>
            </div>

            <div className="bg-gradient-to-br from-orange-50 to-orange-100 p-5 rounded-xl border border-orange-200">
              <div className="flex items-center gap-3 mb-2">
                <Clock className="w-6 h-6 text-orange-600" />
                <h3 className="font-semibold text-orange-900">Atrasos</h3>
              </div>
              <p className="text-2xl font-bold text-orange-700">
                {employeeRanking?.late_count ?? 0}
              </p>
              <p className="text-xs text-orange-600 mt-1">Total registrado</p>
            </div>

            <div className="bg-gradient-to-br from-green-50 to-green-100 p-5 rounded-xl border border-green-200">
              <div className="flex items-center gap-3 mb-2">
                <Award className="w-6 h-6 text-green-600" />
                <h3 className="font-semibold text-green-900">Treinamentos</h3>
              </div>
              <p className="text-2xl font-bold text-green-700">{trainings.length}</p>
              <p className="text-xs text-green-600 mt-1">Concluídos</p>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-[#912325]"></div>
            </div>
          ) : (
            <>
              {absencesDelaysEvolution.length > 0 && (
                <div className="bg-white border border-gray-200 rounded-xl p-6">
                  <div
                    className="flex items-center justify-between mb-4 cursor-pointer"
                    onClick={() => toggleSection('absencesEvolution')}
                  >
                    <div className="flex items-center gap-3">
                      <TrendingUp className="w-6 h-6 text-[#912325]" />
                      <h3 className="text-xl font-bold text-[#912325]">Evolução de Faltas e Atrasos (Todos os Períodos)</h3>
                    </div>
                    <ChevronDown
                      className={`w-5 h-5 text-[#912325] transition-transform ${
                        expandedSections.absencesEvolution ? 'transform rotate-180' : ''
                      }`}
                    />
                  </div>
                  {expandedSections.absencesEvolution && (
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={absencesDelaysEvolution}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="month" />
                        <YAxis allowDecimals={false} />
                        <Tooltip />
                        <Legend />
                        <Line
                          type="monotone"
                          dataKey="Faltas"
                          stroke="#ef4444"
                          strokeWidth={2}
                          dot={{ r: 5 }}
                        />
                        <Line
                          type="monotone"
                          dataKey="Atrasos"
                          stroke="#f97316"
                          strokeWidth={2}
                          dot={{ r: 5 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  )}
                </div>
              )}

              {rankings.length > 0 && (
                <div className="bg-white border border-gray-200 rounded-xl p-6">
                  <div
                    className="flex items-center justify-between mb-4 cursor-pointer"
                    onClick={() => toggleSection('evolution')}
                  >
                    <div className="flex items-center gap-3">
                      <TrendingUp className="w-6 h-6 text-[#912325]" />
                      <h3 className="text-xl font-bold text-[#912325]">Evolução do Ranking</h3>
                    </div>
                    <ChevronDown
                      className={`w-5 h-5 text-[#912325] transition-transform ${
                        expandedSections.evolution ? 'transform rotate-180' : ''
                      }`}
                    />
                  </div>
                  {expandedSections.evolution && (
                  <>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={getRankingChartData()}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis
                          dataKey="period"
                          stroke="#6b7280"
                          style={{ fontSize: '12px' }}
                        />
                        <YAxis
                          yAxisId="left"
                          stroke="#912325"
                          reversed
                          domain={[1, 'dataMax + 5']}
                          label={{ value: 'Posição', angle: -90, position: 'insideLeft', style: { fill: '#912325', fontWeight: 'bold' } }}
                          style={{ fontSize: '12px' }}
                        />
                        <YAxis
                          yAxisId="right"
                          orientation="right"
                          stroke="#f97316"
                          label={{ value: 'Pontuação', angle: 90, position: 'insideRight', style: { fill: '#f97316', fontWeight: 'bold' } }}
                          style={{ fontSize: '12px' }}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: 'white',
                            border: '2px solid #912325',
                            borderRadius: '8px',
                            padding: '12px'
                          }}
                        />
                        <Legend
                          wrapperStyle={{ paddingTop: '20px' }}
                          iconType="line"
                        />
                        <Line
                          yAxisId="left"
                          type="monotone"
                          dataKey="posicao"
                          stroke="#912325"
                          strokeWidth={3}
                          dot={{ fill: '#912325', r: 6 }}
                          activeDot={{ r: 8 }}
                          name="Posição no Ranking"
                        />
                        <Line
                          yAxisId="right"
                          type="monotone"
                          dataKey="pontuacao"
                          stroke="#f97316"
                          strokeWidth={3}
                          dot={{ fill: '#f97316', r: 6 }}
                          activeDot={{ r: 8 }}
                          name="Pontuação Total"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-4">
                    <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                      <p className="text-sm text-gray-700 font-medium mb-1">Melhor Posição</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {Math.min(...rankings.map(r => r.rank_position))}º lugar
                      </p>
                    </div>
                    <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                      <p className="text-sm text-yellow-700 font-medium mb-1">Maior Pontuação</p>
                      <p className="text-2xl font-bold text-yellow-900">
                        {Math.max(...rankings.map(r => r.total_score)).toFixed(1)} pts
                      </p>
                    </div>
                  </div>
                  </>
                  )}
                </div>
              )}

              {rankings.length > 0 && !employeeRanking && (
                <div className="bg-gray-50 border-2 border-gray-200 rounded-xl p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <Activity className="w-6 h-6 text-gray-600" />
                    <h3 className="text-xl font-bold text-gray-900">Análise de Performance</h3>
                  </div>
                  <div className="text-center py-8">
                    <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                    <p className="text-gray-600">
                      Ainda não há dados de performance detalhados para este colaborador.
                    </p>
                    <p className="text-sm text-gray-500 mt-2">
                      Os dados serão calculados no próximo período de avaliação.
                    </p>
                  </div>
                </div>
              )}

              {/* Main Grid */}
              {employeeRanking && (
              <>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Radar de Performance */}
                <div className="bg-gray-50 border-2 border-gray-200 rounded-xl p-6">
                      <h4 className="font-bold text-[#912325] mb-6 text-lg">Radar de Performance</h4>
                      <ResponsiveContainer width="100%" height={320}>
                        <RadarChart data={(employeeRanking?.criterion_scores || []).map(cs => ({
                          criterion: cs.criterion_name,
                          score: cs.normalized_score
                        }))}>
                          <PolarGrid stroke="#d1d5db" />
                          <PolarAngleAxis
                            dataKey="criterion"
                            tick={{ fill: '#912325', fontSize: 12, fontWeight: 600 }}
                          />
                          <PolarRadiusAxis
                            angle={90}
                            domain={[0, 100]}
                            tick={{ fill: '#6b7280', fontSize: 11 }}
                          />
                          <Radar
                            name="Pontuação"
                            dataKey="score"
                            stroke="#912325"
                            fill="#f97316"
                            fillOpacity={0.7}
                            strokeWidth={2}
                          />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: 'white',
                              border: '2px solid #912325',
                              borderRadius: '8px',
                              padding: '8px'
                            }}
                          />
                        </RadarChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Pontos por Critério */}
                    <div className="bg-gray-50 border-2 border-gray-200 rounded-xl p-6">
                      <h4 className="font-bold text-[#912325] mb-6 text-lg">Pontos por Critério</h4>
                      <div className="space-y-4">
                        {(employeeRanking?.criterion_scores || []).map(cs => (
                          <div key={cs.criterion_id}>
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm font-semibold text-gray-700">{cs.criterion_name}</span>
                              <span className="text-sm font-bold text-[#912325]">
                                {formatNumber(cs.weighted_score, 1)} pts
                              </span>
                            </div>
                            <div className="relative">
                              <div className="w-full bg-gray-300 rounded-lg h-6 overflow-hidden">
                                <div
                                  className="h-full bg-gradient-to-r from-[#912325] to-[#f97316] rounded-lg flex items-center justify-end pr-2 transition-all duration-500"
                                  style={{ width: `${cs.normalized_score}%` }}
                                >
                                  {cs.normalized_score > 15 && (
                                    <span className="text-xs font-bold text-white">
                                      {formatNumber(cs.normalized_score, 0)}%
                                    </span>
                                  )}
                                </div>
                              </div>
                              {cs.normalized_score <= 15 && (
                                <span className="absolute right-2 top-0 text-xs font-bold text-gray-600">
                                  {formatNumber(cs.normalized_score, 0)}%
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                </div>

              {/* Pontos Fortes e Sugestões */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
                <div className="bg-green-50 border-2 border-green-200 rounded-xl p-6">
                  <h5 className="font-bold text-green-800 mb-4 text-lg">Pontos Fortes</h5>
                  <ul className="space-y-2">
                    {(employeeRanking?.strengths || []).map((s, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-green-700">
                        <span className="text-green-600 mt-0.5">•</span>
                        <span>{s}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="bg-orange-50 border-2 border-orange-200 rounded-xl p-6">
                  <h5 className="font-bold text-orange-800 mb-4 text-lg">Sugestões de Melhoria</h5>
                  <ul className="space-y-2">
                    {(employeeRanking?.suggestions || []).map((s, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-orange-700">
                        <span className="text-orange-600 mt-0.5">•</span>
                        <span>{s}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
              </>
              )}

              <div className="bg-white border border-gray-200 rounded-xl p-6">
                <div
                  className="flex items-center justify-between mb-4 cursor-pointer"
                  onClick={() => toggleSection('exams')}
                >
                  <div className="flex items-center gap-3">
                    <Shield className="w-6 h-6 text-[#912325]" />
                    <h3 className="text-xl font-bold text-[#912325]">Exames Médicos</h3>
                  </div>
                  <ChevronDown
                    className={`w-5 h-5 text-[#912325] transition-transform ${
                      expandedSections.exams ? 'transform rotate-180' : ''
                    }`}
                  />
                </div>
                {expandedSections.exams && (
                <>
                {exams.length > 0 ? (
                  <div className="space-y-3">
                    {exams.map((exam) => (
                      <div key={exam.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
                        <div className="flex-1">
                          <p className="font-semibold text-gray-900">{exam.exam_type}</p>
                          <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
                            <span>Data: {formatDate(exam.exam_date)}</span>
                            {exam.next_exam_date && (
                              <span>Próximo: {formatDate(exam.next_exam_date)}</span>
                            )}
                            <span className="font-medium">Resultado: {exam.result}</span>
                          </div>
                        </div>
                        {getStatusBadge(exam.status)}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-center py-4">Nenhum exame registrado</p>
                )}
                </>
                )}
              </div>

              <div className="bg-white border border-gray-200 rounded-xl p-6">
                <div
                  className="flex items-center justify-between mb-4 cursor-pointer"
                  onClick={() => toggleSection('trainings')}
                >
                  <div className="flex items-center gap-3">
                    <Activity className="w-6 h-6 text-[#912325]" />
                    <h3 className="text-xl font-bold text-[#912325]">Treinamentos SST</h3>
                  </div>
                  <ChevronDown
                    className={`w-5 h-5 text-[#912325] transition-transform ${
                      expandedSections.trainings ? 'transform rotate-180' : ''
                    }`}
                  />
                </div>
                {expandedSections.trainings && (
                <>
                {trainings.length > 0 ? (
                  <div className="space-y-3">
                    {trainings.map((training) => (
                      <div key={training.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
                        <div className="flex-1">
                          <p className="font-semibold text-gray-900">{training.training_name}</p>
                          <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
                            <span>Tipo: {training.training_type}</span>
                            <span>Conclusão: {formatDate(training.completion_date)}</span>
                            {training.expiry_date && (
                              <span>Validade: {formatDate(training.expiry_date)}</span>
                            )}
                          </div>
                        </div>
                        {getStatusBadge(training.status)}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-center py-4">Nenhum treinamento registrado</p>
                )}
                </>
                )}
              </div>

              <div className="bg-white border border-gray-200 rounded-xl p-6">
                <div
                  className="flex items-center justify-between mb-4 cursor-pointer"
                  onClick={() => toggleSection('comments')}
                >
                  <div className="flex items-center gap-3">
                    <MessageSquare className="w-6 h-6 text-[#912325]" />
                    <h3 className="text-xl font-bold text-[#912325]">Comentários</h3>
                    <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs font-semibold rounded-full">
                      {comments.length}
                    </span>
                  </div>
                  <ChevronDown
                    className={`w-5 h-5 text-[#912325] transition-transform ${
                      expandedSections.comments ? 'transform rotate-180' : ''
                    }`}
                  />
                </div>
                {expandedSections.comments && (
                <>

                <div className="space-y-4 mb-6">
                  {comments.map((comment) => (
                    <div key={comment.id} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="font-semibold text-gray-900">{comment.created_by}</p>
                          <p className="text-xs text-gray-500">
                            {new Date(comment.created_at).toLocaleString('pt-BR')}
                          </p>
                        </div>
                        <button
                          onClick={() => handleDeleteComment(comment.id)}
                          className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                          title="Excluir comentário"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <p className="text-gray-700 whitespace-pre-wrap">{comment.comment}</p>
                    </div>
                  ))}

                  {comments.length === 0 && (
                    <p className="text-gray-500 text-center py-4">Nenhum comentário ainda</p>
                  )}
                </div>

                <div className="border-t border-gray-200 pt-4 space-y-3">
                  <input
                    type="text"
                    placeholder="Seu nome (opcional)"
                    value={commentAuthor}
                    onChange={(e) => setCommentAuthor(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#912325] focus:border-transparent"
                  />

                  <textarea
                    placeholder="Digite seu comentário..."
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    rows={3}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#912325] focus:border-transparent resize-none"
                  />

                  <button
                    onClick={handleAddComment}
                    disabled={savingComment || !newComment.trim()}
                    className="w-full px-4 py-3 bg-gradient-to-r from-[#912325] to-[#701a1c] text-white rounded-lg hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed font-semibold flex items-center justify-center gap-2"
                  >
                    <Send className="w-5 h-5" />
                    {savingComment ? 'Enviando...' : 'Enviar Comentário'}
                  </button>
                </div>
                </>
                )}
              </div>
            </>
          )}
        </div>

        <div className={`flex-shrink-0 flex justify-end p-4 border-t border-gray-200 bg-white ${
          isFullScreen ? 'rounded-none' : 'rounded-b-xl'
        }`}>
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-gradient-to-r from-[#912325] to-[#701a1c] text-white rounded-lg hover:shadow-lg transition-all font-semibold"
          >
            Fechar
          </button>
        </div>
      </motion.div>
    </div>
  );
}