import { FormBuilder } from '@angular/forms';
import { of, throwError } from 'rxjs';
import { toast } from 'ngx-sonner';
import { SimpleChange } from '@angular/core';
import { PosCustomerPickerComponent } from './ui/pos-customer-picker.component';

/** Caracterización de los flujos de cliente del POS: mismas expectativas que antes de extraer el selector. */
describe('POS caja — cliente', () => {
  let pos: { customer: any };
  let picker: any;
  let customers: any;
  const ana = { name: 'CUST-1', nombre: 'ANA PÉREZ', num_identificacion: '0912345678' };
  const finalConsumer = { name: 'CF', nombre: 'Consumidor Final', num_identificacion: '9999999999999' };

  beforeEach(() => {
    spyOn(toast, 'error');
    spyOn(toast, 'warning');
    spyOn(toast, 'success');
    spyOn(toast, 'info');
    customers = {
      get_cliente_by_identificacion: jasmine.createSpy('byId').and.callFake((id: string) =>
        id === '9999999999999' ? of({ message: finalConsumer }) : (id === '0912345678' ? of({ message: ana }) : throwError(() => ({ status: 404 })))),
      searchClientes: jasmine.createSpy('search').and.returnValue(of([])),
      create: jasmine.createSpy('create').and.returnValue(of({ message: { ...ana, name: 'CUST-NEW' } }))
    };
    picker = new PosCustomerPickerComponent(customers, new FormBuilder(), { show: () => undefined, hide: () => undefined } as any);
    // El POS guarda el cliente que emite el selector (como hace (customerChange) en la plantilla).
    pos = { customer: null };
    picker.customerChange.subscribe((customer: any) => { pos.customer = customer; picker.customer = customer; });
    picker.ngOnInit();
  });

  it('selecciona a Consumidor Final con un clic', () => {
    picker.selectFinalConsumer();
    expect(customers.get_cliente_by_identificacion).toHaveBeenCalledWith('9999999999999');
    expect(pos.customer).toEqual(finalConsumer);
  });

  it('busca directo por cédula o RUC exactos', () => {
    picker.onCustomerSearchChange('0912345678');
    picker.searchCustomerFromInput();
    expect(customers.get_cliente_by_identificacion).toHaveBeenCalledWith('0912345678');
    expect(pos.customer).toEqual(ana);
  });

  it('si no existe, abre el alta con la identificación y el tipo según su longitud', () => {
    picker.onCustomerSearchChange('0999999999001');
    picker.searchCustomerFromInput();
    expect(picker.showCustomerModal).toBeTrue();
    expect(picker.clienteForm.get('num_identificacion').value).toBe('0999999999001');
    expect(picker.clienteForm.get('tipo_identificacion').value).toBe('04 - RUC');
    expect(pos.customer).toBeNull();
    expect(toast.error).toHaveBeenCalledWith('Cliente no encontrado con esa identificacion.');
  });

  it('rechaza identificaciones que no tienen 10 ni 13 dígitos', () => {
    picker.identificationCustomer = '12345';
    picker.findByIdentificationCustomer();
    expect(toast.warning).toHaveBeenCalledWith('La identificacion debe tener 10 o 13 digitos.');
    expect(customers.get_cliente_by_identificacion).not.toHaveBeenCalled();
  });

  it('valida el formulario antes de crear y selecciona al cliente creado', () => {
    picker.openCustomerModalFromSearch();
    picker.guardarCliente();
    expect(customers.create).not.toHaveBeenCalled();
    picker.clienteForm.patchValue({ tipo_identificacion: '05 - Cédula' });
    picker.clienteForm.patchValue({ num_identificacion: '0912345678', nombre: 'ANA', correo: 'ana@correo.com', telefono: '0999999999', direccion: 'Quito' });
    picker.guardarCliente();
    expect(customers.create).toHaveBeenCalledTimes(1);
    expect(pos.customer?.name).toBe('CUST-NEW');
    expect(picker.showCustomerModal).toBeFalse();
  });

  it('la cédula debe tener 10 dígitos y el RUC 13', () => {
    const form = picker.clienteForm;
    form.patchValue({ tipo_identificacion: '05 - Cédula' });
    form.patchValue({ num_identificacion: '091234567890' });
    expect(form.get('num_identificacion').errors?.cedulaInvalida).toBeTrue();
    form.patchValue({ tipo_identificacion: '04 - RUC' });
    form.patchValue({ num_identificacion: '0912345678' });
    expect(form.get('num_identificacion').errors?.rucInvalido).toBeTrue();
  });

  it('terminar la venta limpia el cliente y su búsqueda', () => {
    picker.selectFinalConsumer();
    // PosCajaComponent.clearPage() deja customer = null; el selector lo recibe por @Input.
    pos.customer = null;
    picker.customer = null;
    picker.ngOnChanges({ customer: new SimpleChange(finalConsumer, null, false) });
    expect(pos.customer).toBeNull();
    expect(picker.customerSearchTerm).toBe('');
  });
});
