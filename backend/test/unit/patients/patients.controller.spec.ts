/**
 * PatientsController — Unit Tests (delegation)
 */
import { Test, TestingModule } from '@nestjs/testing';
import { PatientsController } from '../../../src/modules/patients/patients.controller.js';
import { PatientsService } from '../../../src/modules/patients/patients.service.js';
import { PatientWalkInService } from '../../../src/modules/patients/patient-walk-in.service.js';

const mockPatientsService = {
  findAll: jest.fn(), findOne: jest.fn(), updatePatient: jest.fn(),
  getListStats: jest.fn(), getPatientStats: jest.fn(), getPatientBookings: jest.fn(),
};
const mockWalkInService = { createWalkIn: jest.fn(), claimAccount: jest.fn() };

describe('PatientsController', () => {
  let controller: PatientsController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PatientsController],
      providers: [
        { provide: PatientsService, useValue: mockPatientsService },
        { provide: PatientWalkInService, useValue: mockWalkInService },
      ],
    }).compile();
    controller = module.get(PatientsController);
  });

  it('findAll → patientsService.findAll()', () => {
    mockPatientsService.findAll.mockResolvedValue([]);
    controller.findAll({} as any);
    expect(mockPatientsService.findAll).toHaveBeenCalled();
  });

  it('getListStats → patientsService.getListStats()', () => {
    mockPatientsService.getListStats.mockResolvedValue({});
    controller.getListStats();
    expect(mockPatientsService.getListStats).toHaveBeenCalled();
  });

  it('findOne → patientsService.findOne()', () => {
    mockPatientsService.findOne.mockResolvedValue({ id: '1' });
    controller.findOne('id-1');
    expect(mockPatientsService.findOne).toHaveBeenCalledWith('id-1');
  });

  it('update → patientsService.updatePatient()', () => {
    mockPatientsService.updatePatient.mockResolvedValue({ id: '1' });
    controller.update('id-1', {} as any);
    expect(mockPatientsService.updatePatient).toHaveBeenCalledWith('id-1', {});
  });

  it('getStats → patientsService.getPatientStats()', () => {
    mockPatientsService.getPatientStats.mockResolvedValue({});
    controller.getStats('id-1');
    expect(mockPatientsService.getPatientStats).toHaveBeenCalledWith('id-1');
  });

  it('getBookings → patientsService.getPatientBookings()', () => {
    mockPatientsService.getPatientBookings.mockResolvedValue([]);
    controller.getBookings('id-1', undefined, undefined);
    expect(mockPatientsService.getPatientBookings).toHaveBeenCalled();
  });

  it('createWalkIn → walkInService.createWalkIn()', () => {
    mockWalkInService.createWalkIn.mockResolvedValue({ id: '1' });
    controller.createWalkIn({} as any);
    expect(mockWalkInService.createWalkIn).toHaveBeenCalled();
  });

  it('claimAccount → walkInService.claimAccount()', () => {
    mockWalkInService.claimAccount.mockResolvedValue({ id: '1' });
    controller.claimAccount({} as any);
    expect(mockWalkInService.claimAccount).toHaveBeenCalled();
  });
});
