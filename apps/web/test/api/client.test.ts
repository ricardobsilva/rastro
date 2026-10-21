import { ApiError, api } from '../../src/api/client';

const fetchMock = vi.fn();
beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

const json = (status: number, body: unknown) =>
  Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }));

describe('api client', () => {
  it('faz GET com cookies e devolve o JSON (sucesso)', async () => {
    fetchMock.mockReturnValue(json(200, { ok: 1 }));
    expect(await api.get('/api/x')).toEqual({ ok: 1 });
    expect(fetchMock).toHaveBeenCalledWith('/api/x', expect.objectContaining({ method: 'GET', credentials: 'same-origin' }));
  });

  it('envia corpo JSON no POST (sucesso)', async () => {
    fetchMock.mockReturnValue(json(201, {}));
    await api.post('/api/x', { a: 1 });
    const init = fetchMock.mock.calls[0]![1] as RequestInit;
    expect(init.body).toBe('{"a":1}');
    expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/json');
  });

  it('lança ApiError com status e mensagem do servidor (erro)', async () => {
    fetchMock.mockReturnValue(json(422, { error: 'Nome obrigatório.', details: { x: 1 } }));
    await expect(api.post('/api/x', {})).rejects.toMatchObject({ status: 422, message: 'Nome obrigatório.', details: { x: 1 } });
  });

  it('falha de rede vira ApiError status 0 (borda)', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    const err = await api.get('/api/x').catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(0);
    expect(err.message).toBe('Sem conexão com o servidor.');
  });

  it('resposta 204 devolve null (borda)', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    expect(await api.del('/api/x')).toBeNull();
  });
});
