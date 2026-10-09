import { RemissionGuideDetailComponent } from './remission-guide-detail.component';

describe('Remission guide detail actions', () => {
  function build(permissions: string[], guide: any): RemissionGuideDetailComponent {
    const capabilities = { hasPermission: (permission: string) => permissions.includes(permission) };
    const component = new RemissionGuideDetailComponent({} as any, {} as any, {} as any, {} as any, {} as any, capabilities as any);
    component.guide = guide;
    return component;
  }
  const ids = (component: RemissionGuideDetailComponent) => component.documentActions.map(action => action.id);

  it('lets a creator emit or edit a draft, without fiscal documents', () => {
    expect(ids(build(['billing.create'], { name: 'FLRG-1', status: 'Borrador' }))).toEqual(['emit', 'edit']);
  });

  it('offers PDF and XML only after authorization', () => {
    expect(ids(build(['billing.manage'], { name: 'FLRG-1', status: 'Autorizada' }))).toEqual(['pdf', 'xml']);
  });

  it('never offers retry while the SRI is still processing', () => {
    const component = build(['billing.manage'], { name: 'FLRG-1', status: 'Emitida', electronic: { access_key: 'key' } });
    expect(ids(component)).toEqual(['consult']);
  });
});
