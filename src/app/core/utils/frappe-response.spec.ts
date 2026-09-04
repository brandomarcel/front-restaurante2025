import { frappeData, frappeList } from './frappe-response';

describe('frappe-response', () => {
  it('unwraps message.data without expecting a nested message property', () => {
    expect(frappeData({ message: { data: { id: 'FBU-00018' } } })).toEqual({ id: 'FBU-00018' });
  });

  it('supports a direct message payload', () => {
    expect(frappeData({ message: { business: 'FBU-00018' } })).toEqual({ business: 'FBU-00018' });
  });

  it('returns an empty list when the payload is not a list', () => {
    expect(frappeList({ message: { data: { id: 1 } } })).toEqual([]);
  });
});
