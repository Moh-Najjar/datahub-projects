import type { Employee, EmployeeInput } from '@/modules/employees/types/employee';

/**
 * The editable fields of a loaded employee, as the update payload (pre-fills the edit form). Editing needs the
 * personal details, so it requires a profile loaded with `hr.employees.view.personal` (every role that may write has it).
 */
export function employeeToInput(e: Employee): EmployeeInput {
  const p = e.personal;
  if (!p) throw new Error('Editing an employee requires their personal details (hr.employees.view.personal).');
  return {
    employeeNumber: e.employeeNumber,
    name: e.name,
    dateOfBirth: p.dateOfBirth,
    gender: p.gender,
    nationality: p.nationality,
    maritalStatus: p.maritalStatus,
    workEmail: e.workEmail,
    personalEmail: p.personalEmail,
    phone: p.phone,
    alternativePhone: p.alternativePhone,
    address: p.address,
    city: p.city,
    country: p.country,
    hireDate: e.hireDate,
    employmentType: e.employmentType,
    contractStartDate: e.contractStartDate,
    contractEndDate: e.contractEndDate,
    probationEndDate: e.probationEndDate,
    departmentId: e.department.id,
    positionId: e.position.id,
    locationId: e.location.id,
    managerId: e.manager?.id ?? null,
    reportingDepartmentId: e.reportingDepartment?.id ?? null,
    emergencyContact: p.emergencyContact,
  };
}
