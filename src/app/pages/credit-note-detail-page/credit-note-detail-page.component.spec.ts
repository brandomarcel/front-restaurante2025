import { CreditNoteDetailPageComponent } from './credit-note-detail-page.component';

describe('Credit note detail actions', () => {
  function build(permissions: string[], invoice: any): CreditNoteDetailPageComponent {
    const capabilities = { isLiteMode: true, hasPermission: (permission: string) => permissions.includes(permission) };
    const component = new CreditNoteDetailPageComponent({} as any, {} as any, {} as any, {} as any, capabilities as any);
    component.invoice = invoice;
    component.loading = false;
    return component;
  }
  const ids = (component: CreditNoteDetailPageComponent) => component.documentActions.map(action => action.id);

  it('offers documents and email, but no SRI actions, once authorized', () => {
    const component = build(['billing.read', 'billing.manage'], { name: 'NC-1', status: 'Autorizada' });
    expect(ids(component)).toEqual(['pdf', 'xml', 'email']);
  });

  it('only allows consulting while authorization is pending', () => {
    const component = build(['billing.read', 'billing.manage'], { name: 'NC-1', status: 'Emitida', electronic: { provider_status: 'PROCESSING' } });
    expect(ids(component)).toEqual(['consult', 'pdf']);
  });

  it('hides every action while loading or without permissions', () => {
    expect(ids(build([], { name: 'NC-1', status: 'Autorizada' }))).toEqual([]);
    const loading = build(['billing.read'], { name: 'NC-1', status: 'Autorizada' });
    loading.loading = true;
    expect(ids(loading)).toEqual([]);
  });
});
