import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { NgxPaginationModule } from 'ngx-pagination';
import { toast } from 'ngx-sonner';
import { NgxSpinnerService } from 'ngx-spinner';
import { RoleKey, UserItem } from 'src/app/core/models/user_item';
import { AlertService } from 'src/app/core/services/alert.service';
import { UserService } from 'src/app/services/user.service';
import { ButtonComponent } from "src/app/shared/components/button/button.component";
import { state } from '@angular/animations';
import { AuthService } from '../../services/auth.service';


@Component({
  selector: 'app-users',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, NgxPaginationModule, FormsModule, ButtonComponent],
  templateUrl: './users.component.html',
})
export class UsersComponent implements OnInit {
  users: UserItem[] = [];
  filtered: UserItem[] = [];

  page = 1;
  pageSize = 10;

  mostrarModal = false;
  editando: UserItem | null = null;
  submitted = false;
  form!: FormGroup;

  userLoged: any;

  // filtro rápido
  private _search = '';
  get search() { return this._search; }
  set search(v: string) { this._search = v || ''; this.filtrar(); }

  roles: { value: RoleKey; label: string }[] = [
    { value: 'gerente', label: 'Gerente' },
    { value: 'cajero', label: 'Cajero' },
  ];

  constructor(
    private usersService: UserService,
    private fb: FormBuilder,
    private spinner: NgxSpinnerService,
    private alertService: AlertService,
    private authService: AuthService
  ) { }

  ngOnInit(): void {
    this.cargar();
    this.initForm();
    this.userLoged = JSON.parse(localStorage.getItem('user') || '{}');
    console.log('userLoged', this.userLoged.email);
  }

  initForm() {
    this.form = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: [''], // requerido solo al crear
      first_name: [''],
      last_name: [''],
      phone: [''],
      role_key: ['cajero', Validators.required],
      enabled: [true],
    });
  }

  cargar() {
    this.spinner.show();
    this.usersService.listByCompany({
      search: this.search || undefined,
      limit: 1000
    }).subscribe({
      next: (rows) => {
        this.spinner.hide();
        this.users = rows;
        this.filtrar();
      },
      error: () => this.spinner.hide()
    });
  }

  abrirModal(u: UserItem | null = null) {
    this.mostrarModal = true;
    this.submitted = false;
    this.editando = u;

    this.form.reset({
      email: u?.email || '',
      password: '',
      first_name: u?.first_name || '',
      last_name: u?.last_name || '',
      phone: u?.phone || '',
      role_key: u?.role_key || 'cajero',
      enabled: (u?.enabled ?? 1) ? true : false,
    });
  }

  cerrarModal() {
    this.mostrarModal = false;
    this.editando = null;
    this.submitted = false;
    this.form.reset();
  }

  filtrar() {
    const t = (this._search || '').toLowerCase();
    this.filtered = (this.users || []).filter(u =>
      (u.email && u.email.toLowerCase().includes(t)) ||
      (u.first_name && u.first_name.toLowerCase().includes(t)) ||
      (u.last_name && u.last_name.toLowerCase().includes(t))
    );
    this.page = 1;
  }

  guardar() {
    this.submitted = true;
    const creating = !this.editando;
    if (creating && !this.form.value.password) {
      this.form.get('password')?.setErrors({ required: true });
    }
    if (this.form.invalid) return;

    const v = this.form.getRawValue();
    this.spinner.show();
    this.usersService.upsert({
      email: v.email,
      password: v.password || '___nochange___', // el backend ignora placeholder al editar
      first_name: v.first_name,
      last_name: v.last_name,
      phone: v.phone,
      role_key: v.role_key,
    }).subscribe({
      next: () => {
        const enabledDesired = !!v.enabled;
        const currentEnabled = !!(this.editando?.enabled ?? 1);
        const maybeToggle = (!creating && enabledDesired !== currentEnabled)
          ? this.usersService.setEnabled(v.email, enabledDesired)
          : null;

        const finalize = () => {
          this.spinner.hide();
          toast.success(creating ? 'Usuario creado' : 'Usuario actualizado');
          this.cerrarModal();
          this.cargar();
        };

        if (maybeToggle) maybeToggle.subscribe({ next: finalize, error: finalize });
        else finalize();
      },
      error: (err) => {
        this.spinner.hide();
        const msg = this.parseFrappeError(err);
        toast.error(msg);
        console.error('register_tenant_open error:', err);
      }
    });
  }

  async toggleEnabled(u: UserItem) {

    console.log('toggleEnabled', u);
    const estado = u.enabled ? 'deshabilitar' : 'habilitar';
    this.alertService.confirm(`¿Desea ${estado} al usuario ${u.email}?`).then(res => {
      console.log('res', res);
      if (res.isConfirmed) {

        const desired = !(u.enabled ?? 1);
        this.usersService.setEnabled(u.email, desired).subscribe({
          next: (response) => {
            console.log('response', response);
            const res = response?.message ;
            u.enabled = desired ? 1 : 0;
            toast.success(desired ? 'Usuario habilitado' : 'Usuario deshabilitado');
            if (!res.enabled && this.userLoged.email === res.user) {
              console.log('logout');
              this.authService.goLogin();
            }
          }
        });
      }

    });

  }

  borrar(u: UserItem) {
    if (!confirm(`¿Eliminar a ${u.email}?`)) return;
    this.usersService.delete(u.email).subscribe({
      next: (res: any) => {
        toast.success('Usuario eliminado');
        this.cargar();
      },
      error: (err) => {
        this.spinner.hide();
        const msg = this.parseFrappeError(err);
        toast.error(msg);
        console.error('register_tenant_open error:', err);
      }
    });
  }

  trackBy = (_: number, i: UserItem) => i.name || i.email;


  /** Extrae un mensaje legible de errores de Frappe */
  private parseFrappeError(err: any): string {
    try {
      const server = err?.error?._server_messages;
      if (server) {
        const arr = JSON.parse(server);
        const first = typeof arr[0] === 'string' ? JSON.parse(arr[0]) : arr[0];
        return first?.message || 'Error en el servidor';
      }
      if (err?.error?.message) return err.error.message;
      if (err?.message) return err.message;
    } catch { }
    return 'No se pudo completar el registro. Verifica los datos e inténtalo nuevamente.';
  }


}


