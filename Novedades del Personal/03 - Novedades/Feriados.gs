/***************************************************************
 * FERIADOS.GS
 * PLANILLA DE NOVEDADES
 *
 * Módulo específico para el tratamiento de feriados.
 *
 * IMPORTANTE:
 * -------------------------------------------------------------
 * Este archivo NO decide por sí solo si una persona cobra
 * feriado trabajado.
 *
 * Se separan claramente tres conceptos:
 *
 * 1. La fecha es feriado.
 * 2. La persona trabajó ese día.
 * 3. La persona tiene derecho al tratamiento de feriado
 *    trabajado según las reglas que posteriormente se validen
 *    contra las planillas actuales.
 *
 * No se inventan fórmulas de liquidación.
 *
 * La identificación general de fechas del calendario puede ser
 * utilizada desde Calendario.gs.
 ***************************************************************/


var FERIADOS_CFG = {
  FORMATO_FECHA: 'dd/MM/yyyy',

  ESTADO_NO_TRABAJO: [
    'F',
    'FRANCO',
    'LICENCIA',
    'LIC',
    'VACACIONES',
    'VAC',
    'BAJA',
    'SUP',
    'OS'
  ],

  PASO_DIAS: 1
};


/* =============================================================
 * NORMALIZACIÓN DE FECHAS
 * ============================================================= */

/**
 * Convierte distintos formatos de fecha a un objeto Date
 * normalizado a medianoche.
 */
function feriadosNormalizarFecha(valor) {
  if (
    valor === null ||
    valor === undefined ||
    valor === ''
  ) {
    return null;
  }

  var fecha;

  if (Object.prototype.toString.call(valor) === '[object Date]') {
    if (isNaN(valor.getTime())) {
      return null;
    }

    fecha = new Date(valor.getTime());

  } else if (typeof valor === 'number') {

    /*
     * Si viene de Sheets como número serial.
     */
    fecha = new Date(
      Math.round(
        (valor - 25569) * 86400 * 1000
      )
    );

  } else if (typeof valor === 'string') {

    var texto = valor.trim();

    if (!texto) {
      return null;
    }

    /*
     * dd/MM/yyyy
     */
    var m = texto.match(
      /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/
    );

    if (m) {
      var dia = Number(m[1]);
      var mes = Number(m[2]) - 1;
      var anio = Number(m[3]);

      fecha = new Date(
        anio,
        mes,
        dia
      );

      if (
        fecha.getFullYear() !== anio ||
        fecha.getMonth() !== mes ||
        fecha.getDate() !== dia
      ) {
        return null;
      }

    } else {

      /*
       * Intento final para formatos reconocibles por JavaScript.
       */
      fecha = new Date(texto);

      if (isNaN(fecha.getTime())) {
        return null;
      }
    }

  } else {
    return null;
  }

  fecha.setHours(0, 0, 0, 0);

  return fecha;
}


/**
 * Genera una clave estable yyyy-MM-dd.
 */
function feriadosClaveFecha(valor) {
  var fecha = feriadosNormalizarFecha(valor);

  if (!fecha) {
    return '';
  }

  return (
    fecha.getFullYear() +
    '-' +
    ('0' + (fecha.getMonth() + 1)).slice(-2) +
    '-' +
    ('0' + fecha.getDate()).slice(-2)
  );
}


/**
 * Compara dos fechas ignorando la hora.
 */
function feriadosMismaFecha(fechaA, fechaB) {
  var claveA = feriadosClaveFecha(fechaA);
  var claveB = feriadosClaveFecha(fechaB);

  return (
    claveA !== '' &&
    claveA === claveB
  );
}


/* =============================================================
 * CATÁLOGO DE FERIADOS
 * ============================================================= */

/**
 * Normaliza un registro de feriado.
 *
 * Estructura esperada:
 *
 * {
 *   fecha: Date o texto,
 *   nombre: 'Nombre del feriado',
 *   tipo: 'NACIONAL',
 *   trasladable: false
 * }
 */
function feriadosNormalizarRegistro(registro) {
  if (!registro) {
    return null;
  }

  var fecha = feriadosNormalizarFecha(
    registro.fecha
  );

  if (!fecha) {
    return null;
  }

  return {
    fecha: fecha,
    clave: feriadosClaveFecha(fecha),
    nombre: String(
      registro.nombre || ''
    ).trim(),
    tipo: String(
      registro.tipo || ''
    ).trim().toUpperCase(),
    trasladable:
      registro.trasladable === true
  };
}


/**
 * Normaliza un listado completo de feriados.
 */
function feriadosNormalizarLista(lista) {
  if (!Array.isArray(lista)) {
    return [];
  }

  var salida = [];
  var vistos = {};

  lista.forEach(function (registro) {

    var normalizado =
      feriadosNormalizarRegistro(
        registro
      );

    if (!normalizado) {
      return;
    }

    /*
     * Evitamos duplicar la misma fecha.
     */
    if (vistos[normalizado.clave]) {
      return;
    }

    vistos[normalizado.clave] = true;

    salida.push(
      normalizado
    );
  });

  salida.sort(function (a, b) {
    return a.fecha.getTime() -
      b.fecha.getTime();
  });

  return salida;
}


/**
 * Busca un feriado dentro de una lista.
 */
function feriadosBuscarEnLista(
  fecha,
  lista
) {
  var clave =
    feriadosClaveFecha(fecha);

  if (!clave) {
    return null;
  }

  var registros =
    feriadosNormalizarLista(lista);

  for (
    var i = 0;
    i < registros.length;
    i++
  ) {
    if (
      registros[i].clave === clave
    ) {
      return registros[i];
    }
  }

  return null;
}


/**
 * Indica si una fecha está incluida en
 * el listado suministrado.
 */
function feriadosExisteEnLista(
  fecha,
  lista
) {
  return (
    feriadosBuscarEnLista(
      fecha,
      lista
    ) !== null
  );
}


/**
 * Obtiene el nombre del feriado.
 */
function feriadosNombreEnLista(
  fecha,
  lista
) {
  var registro =
    feriadosBuscarEnLista(
      fecha,
      lista
    );

  return registro
    ? registro.nombre
    : '';
}


/* =============================================================
 * TRATAMIENTO DE FERIADO TRABAJADO
 * ============================================================= */

/**
 * Normaliza un estado/novedad.
 */
function feriadosNormalizarEstado(valor) {
  if (
    valor === null ||
    valor === undefined
  ) {
    return '';
  }

  return String(valor)
    .trim()
    .toUpperCase();
}


/**
 * Determina si el estado representa explícitamente
 * una situación de no trabajo.
 *
 * IMPORTANTE:
 * Esta función NO determina liquidación.
 */
function feriadosEsEstadoNoTrabajo(
  estado
) {
  var normalizado =
    feriadosNormalizarEstado(
      estado
    );

  if (!normalizado) {
    return false;
  }

  return (
    FERIADOS_CFG.ESTADO_NO_TRABAJO
      .indexOf(normalizado) !== -1
  );
}


/**
 * Determina si existe evidencia de trabajo.
 *
 * El parámetro puede ser:
 *
 * - cantidad de horas
 * - texto de estado
 * - objeto con información de horas/estado
 *
 * Esta función solamente identifica trabajo.
 * No determina si corresponde pagar feriado.
 */
function feriadosHayTrabajo(
  dato
) {
  if (
    dato === null ||
    dato === undefined ||
    dato === ''
  ) {
    return false;
  }

  /*
   * Objeto de novedad.
   */
  if (
    typeof dato === 'object' &&
    !(
      Object.prototype.toString.call(dato) ===
      '[object Date]'
    )
  ) {

    if (
      dato.estado !== undefined &&
      feriadosEsEstadoNoTrabajo(
        dato.estado
      )
    ) {
      return false;
    }

    var posiblesHoras = [
      dato.horas,
      dato.horasTotales,
      dato.horasTrabajadas,
      dato.totalHoras,
      dato.cantidad
    ];

    for (
      var i = 0;
      i < posiblesHoras.length;
      i++
    ) {
      if (
        posiblesHoras[i] !== null &&
        posiblesHoras[i] !== undefined &&
        posiblesHoras[i] !== '' &&
        isFinite(
          Number(
            posiblesHoras[i]
          )
        ) &&
        Number(
          posiblesHoras[i]
        ) > 0
      ) {
        return true;
      }
    }

    return false;
  }

  /*
   * Número de horas.
   */
  if (
    typeof dato === 'number'
  ) {
    return (
      isFinite(dato) &&
      dato > 0
    );
  }

  /*
   * Texto.
   */
  var texto =
    feriadosNormalizarEstado(
      dato
    );

  if (
    feriadosEsEstadoNoTrabajo(
      texto
    )
  ) {
    return false;
  }

  /*
   * Si es un número escrito como texto.
   */
  if (
    texto !== '' &&
    isFinite(Number(texto))
  ) {
    return Number(texto) > 0;
  }

  /*
   * Cualquier otro texto no se considera
   * automáticamente trabajo.
   */
  return false;
}


/**
 * Determina si una persona trabajó un feriado.
 *
 * IMPORTANTE:
 * -------------------------------------------------------------
 * Esto solamente responde si hubo trabajo.
 *
 * No devuelve:
 * - importe
 * - porcentaje
 * - valor de feriado
 * - horas pagas
 *
 * Esas reglas deben reconstruirse posteriormente
 * desde las planillas actuales.
 */
function feriadosTrabajado(
  fecha,
  datoTrabajo,
  listaFeriados
) {
  var feriado =
    feriadosBuscarEnLista(
      fecha,
      listaFeriados
    );

  if (!feriado) {
    return {
      ok: true,
      esFeriado: false,
      trabajado: false,
      fecha: feriadosClaveFecha(
        fecha
      ),
      nombre: ''
    };
  }

  var trabajado =
    feriadosHayTrabajo(
      datoTrabajo
    );

  return {
    ok: true,
    esFeriado: true,
    trabajado: trabajado,
    fecha: feriado.clave,
    nombre: feriado.nombre,
    tipo: feriado.tipo
  };
}


/* =============================================================
 * INFORMACIÓN PARA CALENDARIO
 * ============================================================= */

/**
 * Devuelve información resumida de una fecha.
 */
function feriadosInformacionFecha(
  fecha,
  listaFeriados
) {
  var normalizada =
    feriadosNormalizarFecha(
      fecha
    );

  if (!normalizada) {
    return {
      ok: false,
      error: 'Fecha inválida.'
    };
  }

  var feriado =
    feriadosBuscarEnLista(
      normalizada,
      listaFeriados
    );

  return {
    ok: true,
    fecha:
      feriadosClaveFecha(
        normalizada
      ),
    esFeriado:
      feriado !== null,
    nombre:
      feriado
        ? feriado.nombre
        : '',
    tipo:
      feriado
        ? feriado.tipo
        : ''
  };
}


/**
 * Obtiene todos los feriados de un período.
 *
 * fechaDesde y fechaHasta pueden ser Date
 * o textos reconocibles.
 */
function feriadosDelPeriodo(
  fechaDesde,
  fechaHasta,
  listaFeriados
) {
  var desde =
    feriadosNormalizarFecha(
      fechaDesde
    );

  var hasta =
    feriadosNormalizarFecha(
      fechaHasta
    );

  if (!desde || !hasta) {
    return [];
  }

  if (
    desde.getTime() >
    hasta.getTime()
  ) {
    var tmp = desde;
    desde = hasta;
    hasta = tmp;
  }

  var lista =
    feriadosNormalizarLista(
      listaFeriados
    );

  return lista.filter(
    function (registro) {
      return (
        registro.fecha.getTime() >=
          desde.getTime() &&
        registro.fecha.getTime() <=
          hasta.getTime()
      );
    }
  );
}


/* =============================================================
 * CONSTRUCCIÓN DE REGISTROS
 * ============================================================= */

/**
 * Crea un registro de feriado.
 *
 * No lo guarda en ninguna hoja.
 */
function crearRegistroFeriado(
  fecha,
  nombre,
  tipo,
  trasladable
) {
  return feriadosNormalizarRegistro({
    fecha: fecha,
    nombre: nombre,
    tipo: tipo,
    trasladable:
      trasladable === true
  });
}


/**
 * Convierte registros de feriados a una matriz
 * apta para escribir en Sheets.
 *
 * Columnas:
 *
 * Fecha | Nombre | Tipo | Trasladable
 */
function feriadosAValores(
  listaFeriados
) {
  var lista =
    feriadosNormalizarLista(
      listaFeriados
    );

  return lista.map(
    function (registro) {
      return [
        registro.fecha,
        registro.nombre,
        registro.tipo,
        registro.trasladable
      ];
    }
  );
}


/* =============================================================
 * VALIDACIÓN
 * ============================================================= */

/**
 * Valida un registro individual.
 */
function validarRegistroFeriado(
  registro
) {
  var normalizado =
    feriadosNormalizarRegistro(
      registro
    );

  if (!normalizado) {
    return {
      ok: false,
      error: 'El registro de feriado es inválido.'
    };
  }

  if (!normalizado.nombre) {
    return {
      ok: false,
      error: 'El feriado debe tener un nombre.'
    };
  }

  return {
    ok: true,
    registro: normalizado
  };
}


/**
 * Valida un listado completo.
 */
function validarListaFeriados(
  lista
) {
  if (!Array.isArray(lista)) {
    return {
      ok: false,
      error: 'La lista de feriados debe ser un arreglo.'
    };
  }

  var errores = [];
  var claves = {};

  lista.forEach(
    function (registro, indice) {

      var validacion =
        validarRegistroFeriado(
          registro
        );

      if (!validacion.ok) {
        errores.push({
          indice: indice,
          error: validacion.error
        });

        return;
      }

      var clave =
        validacion.registro.clave;

      if (claves[clave]) {
        errores.push({
          indice: indice,
          error:
            'Existe más de un feriado para la fecha ' +
            clave +
            '.'
        });
      }

      claves[clave] = true;
    }
  );

  return {
    ok: errores.length === 0,
    errores: errores,
    cantidad:
      lista.length
  };
}


/* =============================================================
 * PRUEBAS
 * ============================================================= */

/**
 * Prueba básica de normalización.
 */
function probarFeriados() {

  var lista = [
    {
      fecha: '25/05/2026',
      nombre: '25 de Mayo',
      tipo: 'NACIONAL'
    },
    {
      fecha: '20/06/2026',
      nombre: 'Paso a la Inmortalidad del General Belgrano',
      tipo: 'NACIONAL'
    },
    {
      fecha: '09/07/2026',
      nombre: 'Día de la Independencia',
      tipo: 'NACIONAL'
    }
  ];

  var resultados = [];

  resultados.push(
    feriadosInformacionFecha(
      '25/05/2026',
      lista
    )
  );

  resultados.push(
    feriadosInformacionFecha(
      '26/05/2026',
      lista
    )
  );

  resultados.push(
    feriadosTrabajado(
      '25/05/2026',
      8,
      lista
    )
  );

  resultados.push(
    feriadosTrabajado(
      '25/05/2026',
      'F',
      lista
    )
  );

  Logger.log(
    JSON.stringify(
      resultados,
      null,
      2
    )
  );

  return resultados;
}