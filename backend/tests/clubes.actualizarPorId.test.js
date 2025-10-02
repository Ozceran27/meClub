const mockQuery = jest.fn();

jest.mock('../config/db', () => ({
  query: (...args) => mockQuery(...args),
}));

const ClubesModel = require('../models/clubes.model');

describe('ClubesModel.actualizarPorId', () => {
  beforeEach(() => {
    mockQuery.mockReset();
  });

  it('construye el UPDATE correctamente y devuelve el club actualizado', async () => {
    const pngHeader = Buffer.from('89504e470d0a1a0a', 'hex');
    mockQuery
      .mockResolvedValueOnce([[{ club_id: 1, foto_logo: Buffer.from('/uploads/logos/old.png') }]])
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      .mockResolvedValueOnce([
        [
          {
            club_id: 1,
            nombre: 'Club Trim',
            descripcion: 'Descripcion',
            foto_logo: pngHeader,
            provincia_id: 5,
          },
        ],
      ]);

    const resultado = await ClubesModel.actualizarPorId(1, {
      nombre: '  Club Trim  ',
      descripcion: 'Descripcion ',
      foto_logo: Buffer.from('nueva-imagen'),
      provincia_id: '5',
    });

    expect(mockQuery).toHaveBeenNthCalledWith(1, 'SELECT * FROM clubes WHERE club_id = ?', [1]);
    expect(mockQuery).toHaveBeenNthCalledWith(
      2,
      'UPDATE clubes SET nombre = ?, descripcion = ?, foto_logo = ?, provincia_id = ? WHERE club_id = ?',
      ['Club Trim', 'Descripcion', expect.any(Buffer), 5, 1]
    );
    expect(mockQuery).toHaveBeenNthCalledWith(3, 'SELECT * FROM clubes WHERE club_id = ?', [1]);

    expect(resultado).toMatchObject({
      club_id: 1,
      nombre: 'Club Trim',
      descripcion: 'Descripcion',
      foto_logo: 'data:image/png;base64,iVBORw0KGgo=',
      provincia_id: 5,
    });
  });

  it('permite setear provincia_id en NULL y omite campos no enviados', async () => {
    const expectedClub = {
      club_id: 2,
      nombre: 'Club',
      descripcion: null,
      foto_logo: null,
      provincia_id: null,
    };

    mockQuery
      .mockResolvedValueOnce([[{ club_id: 2, foto_logo: 'persist.png' }]])
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      .mockResolvedValueOnce([[expectedClub]]);

    const resultado = await ClubesModel.actualizarPorId(2, {
      nombre: 'Club',
      provincia_id: null,
    });

    expect(mockQuery).toHaveBeenNthCalledWith(1, 'SELECT * FROM clubes WHERE club_id = ?', [2]);
    expect(mockQuery).toHaveBeenNthCalledWith(2, 'UPDATE clubes SET nombre = ?, provincia_id = NULL WHERE club_id = ?', [
      'Club',
      2,
    ]);

    expect(resultado).toMatchObject(expectedClub);
  });

  it('convierte cadenas vacías a NULL', async () => {
    const expectedClub = {
      club_id: 3,
      nombre: 'Nombre original',
      descripcion: null,
      foto_logo: null,
      provincia_id: 3,
    };

    mockQuery
      .mockResolvedValueOnce([[{ club_id: 3, foto_logo: 'anterior.png' }]])
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      .mockResolvedValueOnce([[expectedClub]]);

    const resultado = await ClubesModel.actualizarPorId(3, {
      nombre: 'Nombre original',
      descripcion: '   ',
      foto_logo: '',
      provincia_id: 3,
    });

    expect(mockQuery).toHaveBeenNthCalledWith(
      2,
      'UPDATE clubes SET nombre = ?, descripcion = NULL, foto_logo = NULL, provincia_id = ? WHERE club_id = ?',
      ['Nombre original', 3, 3]
    );

    expect(resultado).toMatchObject(expectedClub);
  });

  it('actualiza datos de contacto y coordenadas', async () => {
    const expectedClub = {
      club_id: 4,
      nombre: 'Club Contacto',
      telefono_contacto: '1234567',
      email_contacto: 'contacto@club.com',
      direccion: 'Calle 123',
      google_place_id: 'place123',
      latitud: -34.5,
      longitud: -58.4,
    };

    mockQuery
      .mockResolvedValueOnce([[{ club_id: 4 }]])
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      .mockResolvedValueOnce([[expectedClub]]);

    const resultado = await ClubesModel.actualizarPorId(4, {
      nombre: 'Club Contacto',
      telefono_contacto: '1234567',
      email_contacto: 'contacto@club.com',
      direccion: 'Calle 123',
      latitud: '-34.5',
      longitud: -58.4,
      google_place_id: 'place123',
    });

    expect(mockQuery).toHaveBeenNthCalledWith(2,
      'UPDATE clubes SET nombre = ?, telefono_contacto = ?, email_contacto = ?, direccion = ?, google_place_id = ?, latitud = ?, longitud = ? WHERE club_id = ?',
      [
        'Club Contacto',
        '1234567',
        'contacto@club.com',
        'Calle 123',
        'place123',
        -34.5,
        -58.4,
        4,
      ]);

    expect(resultado).toMatchObject({
      ...expectedClub,
      foto_logo: null,
    });
  });

  it('lanza error si provincia_id no es numérico', async () => {
    mockQuery.mockResolvedValueOnce([[{ club_id: 1 }]]);

    await expect(
      ClubesModel.actualizarPorId(1, { nombre: 'Club', provincia_id: 'abc' })
    ).rejects.toThrow('provincia_id debe ser numérico o null');
  });
});
