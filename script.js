// ================= CONFIGURACIÓN =================
const WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbx6fHkmlk52BUDCCe9b-wwj_PtGxKYZd8MAvDLLGtP6DbdjjWaMkTr94jCZRValS7FPjQ/exec';

// MODO DEBUG
const DEBUG_MODE = true;

function log(...args) {
    if (DEBUG_MODE) {
        console.log('[DEBUG]', ...args);
    }
}

// ================= VARIABLES GLOBALES =================
let ordenActual = null;
let dteSeleccionado = null;
let currentStep = 1;


//Cambio
// ================= ELEMENTOS DEL DOM =================
const step1 = document.getElementById('step1');
const step2 = document.getElementById('step2');
const step3 = document.getElementById('step3');

const trackingPOSInput = document.getElementById('trackingPOS');
const btnBuscar = document.getElementById('btnBuscar');
const btnBuscarText = document.getElementById('btnBuscarText');
const btnBuscarSpinner = document.getElementById('btnBuscarSpinner');
const mensajeBusqueda = document.getElementById('mensajeBusqueda');

const dteCards = document.querySelectorAll('.dte-card');
const btnContinuarStep2 = document.getElementById('btnContinuarStep2');
const btnVolverStep1 = document.getElementById('btnVolverStep1');
const btnVolverStep2 = document.getElementById('btnVolverStep2');

const facturaForm = document.getElementById('facturaForm');
const btnEnviar = document.getElementById('btnEnviar');
const btnEnviarText = document.getElementById('btnEnviarText');
const btnEnviarSpinner = document.getElementById('btnEnviarSpinner');
const mensajeRespuesta = document.getElementById('mensajeRespuesta');

// ================= FUNCIONES DE NAVEGACIÓN =================
function cambiarPaso(paso) {
    document.querySelectorAll('.step-container').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.step-dot').forEach(d => d.classList.remove('active'));
    
    document.getElementById(`step${paso}`).classList.add('active');
    document.querySelector(`.step-dot[data-step="${paso}"]`).classList.add('active');
    
    currentStep = paso;
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ================= PASO 1: BUSCAR ORDEN =================
btnBuscar.addEventListener('click', async () => {
    const trackingPOS = trackingPOSInput.value.trim();
    
    if (!trackingPOS) {
        mostrarMensaje(mensajeBusqueda, 'Por favor ingresa un número de Tracking POS', 'danger');
        return;
    }

    log('Buscando orden con Tracking POS:', trackingPOS);

    btnBuscar.disabled = true;
    btnBuscarText.textContent = 'Buscando...';
    btnBuscarSpinner.classList.remove('d-none');
    mensajeBusqueda.classList.add('d-none');

    try {
        const url = `${WEB_APP_URL}?action=buscarOrden&trackingPOS=${encodeURIComponent(trackingPOS)}`;
console.log('URL completa que se va a llamar:', url);
log('URL completa que se va a llamar:', url);
        
        const data = await fetchWithScript(url);
        log('Datos recibidos:', data);

        if (data.success) {
            ordenActual = data.data.orden;
            log('Orden encontrada:', ordenActual);
            mostrarInfoOrden(ordenActual);
            cambiarPaso(2);
        } else {
            log('Error en búsqueda:', data.message);
            mostrarMensaje(mensajeBusqueda, data.message || 'No se encontró la orden', 'danger');
        }
    } catch (error) {
        console.error('Error completo:', error);
        log('Error al buscar:', error.message);
        mostrarMensaje(mensajeBusqueda, 'Error al buscar la orden. Verifica la configuración.', 'danger');
    } finally {
        btnBuscar.disabled = false;
        btnBuscarText.textContent = 'Buscar Orden';
        btnBuscarSpinner.classList.add('d-none');
    }
});

// Función JSONP para evitar CORS
function fetchWithScript(url) {
    return new Promise((resolve, reject) => {
        const callbackName = 'callback_' + Date.now();
        
        window[callbackName] = function(data) {
            delete window[callbackName];
            document.body.removeChild(script);
            resolve(data);
        };

        const script = document.createElement('script');
        script.src = url + '&callback=' + callbackName;
        script.onerror = () => {
            delete window[callbackName];
            document.body.removeChild(script);
            reject(new Error('Error al cargar el script'));
        };
        
        document.body.appendChild(script);
        
        setTimeout(() => {
            if (window[callbackName]) {
                delete window[callbackName];
                if (document.body.contains(script)) {
                    document.body.removeChild(script);
                }
                reject(new Error('Timeout: El servidor no respondió'));
            }
        }, 10000);
    });
}

// Nueva función para enviar datos grandes por iframe
function enviarPorIframe(datos) {
    return new Promise((resolve, reject) => {
        log('Enviando datos por iframe...');
        
        // Crear iframe oculto
        const iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        iframe.name = 'envio_' + Date.now();
        document.body.appendChild(iframe);
        
        // Crear formulario
        const form = document.createElement('form');
        form.target = iframe.name;
        form.method = 'POST';
        form.action = WEB_APP_URL;
        
        // Agregar datos como campos ocultos
        const campoAction = document.createElement('input');
        campoAction.type = 'hidden';
        campoAction.name = 'action';
        campoAction.value = 'guardarSolicitud';
        form.appendChild(campoAction);
        
        const campoDatos = document.createElement('input');
        campoDatos.type = 'hidden';
        campoDatos.name = 'datos';
        campoDatos.value = JSON.stringify(datos);
        form.appendChild(campoDatos);
        
        document.body.appendChild(form);
        
        // Timeout de 15 segundos
        const timeoutId = setTimeout(() => {
            document.body.removeChild(form);
            document.body.removeChild(iframe);
            resolve({ success: true, message: 'Solicitud enviada (timeout alcanzado, pero probablemente se guardó)' });
        }, 15000);
        
        // Listener para cuando el iframe cargue
        iframe.onload = () => {
            clearTimeout(timeoutId);
            
            try {
                // Intentar leer la respuesta del iframe
                const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
                const respuesta = iframeDoc.body.textContent;
                
                if (respuesta) {
                    const resultado = JSON.parse(respuesta);
                    document.body.removeChild(form);
                    document.body.removeChild(iframe);
                    resolve(resultado);
                } else {
                    // Si no hay respuesta, asumir éxito después de unos segundos
                    setTimeout(() => {
                        document.body.removeChild(form);
                        document.body.removeChild(iframe);
                        resolve({ success: true, message: 'Solicitud enviada correctamente' });
                    }, 2000);
                }
            } catch (error) {
                log('No se pudo leer respuesta del iframe (esto es normal):', error);
                // Asumir éxito si el iframe cargó sin error
                setTimeout(() => {
                    document.body.removeChild(form);
                    document.body.removeChild(iframe);
                    resolve({ success: true, message: 'Solicitud enviada correctamente' });
                }, 2000);
            }
        };
        
        // Enviar formulario
        form.submit();
    });
}

trackingPOSInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        btnBuscar.click();
    }
});

// ================= MOSTRAR INFO DE LA ORDEN =================
function mostrarInfoOrden(orden) {
    const ordenInfo = document.getElementById('ordenInfo');
    
    let itemsHTML = '';
    
    if (orden.items && orden.items.length > 0) {
        const listaItems = orden.items.map(item => {
            const tienePrecio = item.subtotal && item.subtotal !== '0.00';
            
            return `
            <div class="item-row" style="display: grid; grid-template-columns: 40px 1fr auto; gap: 12px; padding: 10px 0; border-bottom: 1px solid #1e293b; align-items: start;">
                <div style="background: #fbbf24; color: #0f172a; font-weight: 800; text-align: center; border-radius: 6px; padding: 2px 0; font-size: 0.9rem;">
                    ${item.cantidad}
                </div>
                
                <div>
                <div style="color: #e2e8f0; font-weight: 500; font-size: 0.95rem; line-height: 1.3;">
                ${item.producto}
            </div>
            ${tienePrecio ? `<div style="font-size: 0.75rem; color: #64748b; margin-top: 2px;">$${item.precio_unitario} c/u</div>` : ''}
                </div>

                <div style="color: #22c55e; font-weight: 700; text-align: right; font-size: 1rem;">
                    ${tienePrecio ? '$' + item.subtotal : ''}
                </div>
            </div>`;
        }).join('');

        itemsHTML = `
            <div style="background: #0f172a; border-radius: 12px; padding: 20px; margin-top: 20px; border: 1px solid #334155; box-shadow: inset 0 0 20px rgba(0,0,0,0.2);">
                <h5 style="color: #fbbf24; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 15px; border-bottom: 2px solid #1e293b; padding-bottom: 10px; display: flex; align-items: center; gap: 8px;">
                    <i class="fas fa-receipt"></i> Detalle de Consumo
                </h5>
                
                <div class="items-list mb-3">
                    ${listaItems}
                </div>

                <div style="border-top: 1px dashed #475569; padding-top: 15px; display: flex; justify-content: space-between; align-items: flex-end;">
                    <span style="color: #94a3b8; font-size: 0.9rem;">Total Orden</span>
                    <span style="color: #22c55e; font-size: 1.5rem; font-weight: 800; line-height: 1;">$${parseFloat(orden.total).toFixed(2)}</span>
                </div>
            </div>
        `;
    } else {
        itemsHTML = `<div class="alert alert-warning mt-3"><i class="fas fa-exclamation-triangle me-2"></i>No se pudieron desglosar los items de esta orden.</div>`;
    }
    
    ordenInfo.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
            <div style="display: flex; align-items: center; gap: 10px;">
                <i class="fas fa-check-circle" style="color: #22c55e; font-size: 1.5rem;"></i>
                <h4 style="color: #fff; margin: 0; font-size: 1.25rem;">Orden Encontrada</h4>
            </div>
            <span class="badge" style="background: rgba(34, 197, 94, 0.2); color: #22c55e; border: 1px solid #22c55e;">${orden.fecha}</span>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
            <div style="background: #1e293b; border-radius: 8px; padding: 12px; border: 1px solid #334155;">
                <small style="color: #94a3b8; display: block; margin-bottom: 4px; font-size: 0.75rem; text-transform: uppercase;">Cliente</small>
                <div style="color: #f8fafc; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${orden.cliente || 'Consumidor Final'}</div>
            </div>
            <div style="background: #1e293b; border-radius: 8px; padding: 12px; border: 1px solid #334155;">
                <small style="color: #94a3b8; display: block; margin-bottom: 4px; font-size: 0.75rem; text-transform: uppercase;">Factura #</small>
                <div style="color: #fbbf24; font-weight: 600;">${orden.factura || 'Pendiente'}</div>
            </div>
        </div>

        ${itemsHTML}
    `;
}

// ================= PASO 2: SELECCIONAR DTE =================
dteCards.forEach(card => {
    card.addEventListener('click', () => {
        dteCards.forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        dteSeleccionado = {
            codigo: card.dataset.dte,
            nombre: card.dataset.nombre
        };
        btnContinuarStep2.disabled = false;
    });
});

btnContinuarStep2.addEventListener('click', () => {
    configurarCamposPorDTE(dteSeleccionado.codigo);
    cambiarPaso(3);
});

btnVolverStep1.addEventListener('click', () => {
    cambiarPaso(1);
});

btnVolverStep2.addEventListener('click', () => {
    cambiarPaso(2);
});

// ================= CONFIGURAR CAMPOS SEGÚN DTE =================
function configurarCamposPorDTE(codigoDTE) {
    document.querySelectorAll('.campo-condicional').forEach(campo => {
        campo.classList.remove('visible');
        const inputs = campo.querySelectorAll('input, textarea, select');
        inputs.forEach(input => {
            input.removeAttribute('required');
        });
    });

    if (codigoDTE === '01') {
        document.getElementById('nitRequerido').textContent = '';
        document.getElementById('nit').removeAttribute('required');
        
    } else if (codigoDTE === '03') {
        document.getElementById('nitRequerido').textContent = '*';
        document.getElementById('nit').setAttribute('required', 'required');
        
        document.getElementById('campoNRC').classList.add('visible');
        document.getElementById('nrc').setAttribute('required', 'required');
        
        document.getElementById('campoGiro').classList.add('visible');
        document.getElementById('giro').setAttribute('required', 'required');
        
        document.getElementById('campoDireccion').classList.add('visible');
        document.getElementById('direccion').setAttribute('required', 'required');
        
        document.getElementById('campoUbicacion').classList.add('visible');
        document.getElementById('departamento').setAttribute('required', 'required');
        document.getElementById('municipio').setAttribute('required', 'required');
        
    } else if (codigoDTE === '14') {
        document.getElementById('nitRequerido').textContent = '*';
        document.getElementById('nit').setAttribute('required', 'required');
        
        document.getElementById('campoDUI').classList.add('visible');
    }
}

// ================= ENVÍO DEL FORMULARIO (CORREGIDO) =================
facturaForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (!ordenActual || !dteSeleccionado) {
        mostrarMensaje(mensajeRespuesta, 'Error: Información de orden o DTE no disponible', 'danger');
        return;
    }

    const datos = {
        trackingPOS: ordenActual.tracking_number || '',          // ¡Este es el campo correcto!
        factura: ordenActual.factura || '',
        cliente: ordenActual.cliente || 'Consumidor Final',
        tipoDTE: dteSeleccionado.codigo,
        nombreDTE: dteSeleccionado.nombre,
        nombre: document.getElementById('nombre').value.trim(),
        nit: document.getElementById('nit').value.trim(),
        nrc: document.getElementById('nrc').value.trim(),
        dui: document.getElementById('dui').value.trim(),
        email: document.getElementById('email').value.trim(),
        telefono: document.getElementById('telefono').value.trim(),
        giro: document.getElementById('giro').value.trim(),
        direccion: document.getElementById('direccion').value.trim(),
        departamento: document.getElementById('departamento').value,
        municipio: document.getElementById('municipio').value.trim(),
        items: ordenActual.items || [],
        itemsTexto: ordenActual.itemsTexto || '',
        totalOrden: ordenActual.total || '0.00'
    };

    btnEnviar.disabled = true;
    btnEnviarText.textContent = 'Enviando...';
    btnEnviarSpinner.classList.remove('d-none');
    mensajeRespuesta.classList.add('d-none');

    try {
        log('Enviando solicitud con datos:', datos);
        
        // CORRECCIÓN: Usar iframe para POST (evita límite de URL)
        const result = await enviarPorIframe(datos);
        
        log('Resultado del envío:', result);

        if (result.success) {
            mostrarMensaje(mensajeRespuesta, 
                '¡Solicitud enviada exitosamente! Recibirás tu factura electrónica en el correo proporcionado.', 
                'success');
            
            setTimeout(() => {
                location.reload();
            }, 3000);
        } else {
            mostrarMensaje(mensajeRespuesta, 
                result.message || 'Error al enviar la solicitud. Por favor intenta nuevamente.', 
                'danger');
        }
    } catch (error) {
        console.error('Error:', error);
        mostrarMensaje(mensajeRespuesta, 
            'Error al procesar la solicitud: ' + error.message, 
            'danger');
    } finally {
        btnEnviar.disabled = false;
        btnEnviarText.textContent = 'Solicitar Factura';
        btnEnviarSpinner.classList.add('d-none');
    }
});

// ================= FUNCIONES AUXILIARES =================
function mostrarMensaje(elemento, mensaje, tipo) {
    elemento.className = `alert alert-${tipo}`;
    elemento.innerHTML = `<i class="fas fa-${tipo === 'success' ? 'check-circle' : 'exclamation-triangle'} me-2"></i>${mensaje}`;
    elemento.classList.remove('d-none');
    
    setTimeout(() => {
        elemento.classList.add('d-none');
    }, 5000);
}

// ================= FORMATEO DE INPUTS =================
document.getElementById('nit').addEventListener('input', (e) => {
    let valor = e.target.value.replace(/[^0-9]/g, '');
    if (valor.length > 4) {
        valor = valor.slice(0, 4) + '-' + valor.slice(4);
    }
    if (valor.length > 11) {
        valor = valor.slice(0, 11) + '-' + valor.slice(11);
    }
    if (valor.length > 15) {
        valor = valor.slice(0, 15) + '-' + valor.slice(15, 16);
    }
    e.target.value = valor;
});

document.getElementById('nrc').addEventListener('input', (e) => {
    let valor = e.target.value.replace(/[^0-9]/g, '');
    if (valor.length > 6) {
        valor = valor.slice(0, 6) + '-' + valor.slice(6, 7);
    }
    e.target.value = valor;
});

document.getElementById('dui').addEventListener('input', (e) => {
    let valor = e.target.value.replace(/[^0-9]/g, '');
    if (valor.length > 8) {
        valor = valor.slice(0, 8) + '-' + valor.slice(8, 9);
    }
    e.target.value = valor;
});

document.getElementById('telefono').addEventListener('input', (e) => {
    let valor = e.target.value.replace(/[^0-9]/g, '');
    if (valor.length > 4) {
        valor = valor.slice(0, 4) + '-' + valor.slice(4, 8);
    }
    e.target.value = valor;
});

log('✅ Sistema iniciado correctamente');
