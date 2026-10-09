/* =========================================================
   CLON DE SPOTIFY
   Buscador de música con la API de búsqueda de iTunes.
   - Inicio: búsquedas sugeridas
   - Buscar: resultados por artista, canción o álbum
   - Biblioteca: canciones guardadas con "Me gusta" (localStorage)
   - Reproductor único en la parte de abajo
   ========================================================= */

const API = 'https://itunes.apple.com/search';
const CLAVE_BIBLIOTECA = 'spotifyClon.biblioteca';
const SUGERENCIAS = ['Imagine Dragons', 'Bad Bunny', 'Natalia Lafourcade', 'Queen', 'Dua Lipa', 'Café Tacvba', 'The Weeknd', 'Soda Stereo'];

const ICONO_PLAY = 'M8 5v14l11-7z';
const ICONO_PAUSA = 'M7 5h4v14H7zm6 0h4v14h-4z';
const ICONO_CORAZON = 'M12 21s-7.5-4.6-9.6-9.2C.9 8.4 2.9 4.5 6.6 4.5c2 0 3.6 1 5.4 3 1.8-2 3.4-3 5.4-3 3.7 0 5.7 3.9 4.2 7.3C19.5 16.4 12 21 12 21z';

// ---------- Referencias del DOM ----------
const songsContainer = document.getElementById('songsContainer');
const searchForm = document.getElementById('searchForm');
const searchInput = document.getElementById('searchInput');
const elSugerencias = document.getElementById('sugerencias');
const elTitulo = document.getElementById('tituloVista');
const elSubtitulo = document.getElementById('subtitulo');
const elEstado = document.getElementById('estado');
const elContador = document.getElementById('contadorBiblioteca');

const audio = document.getElementById('audio');
const reproductor = document.getElementById('reproductor');
const repPlay = document.getElementById('repPlay');
const repIcono = document.getElementById('repIcono');
const repBarra = document.getElementById('repBarra');
const repActual = document.getElementById('repActual');
const repTotal = document.getElementById('repTotal');

// ---------- Estado ----------
let vista = 'inicio';
let cancionActual = null;   // trackId de lo que suena
let busquedaEnCurso = 0;    // descarta respuestas de búsquedas anteriores
let biblioteca = leerBiblioteca();

// ---------- Biblioteca (localStorage) ----------
function leerBiblioteca() {
    try {
        return JSON.parse(localStorage.getItem(CLAVE_BIBLIOTECA)) || [];
    } catch {
        return [];
    }
}

function guardarBiblioteca() {
    try {
        localStorage.setItem(CLAVE_BIBLIOTECA, JSON.stringify(biblioteca));
    } catch { /* navegador sin almacenamiento: la biblioteca dura lo que la pestaña */ }
    elContador.textContent = biblioteca.length;
    elContador.hidden = biblioteca.length === 0;
}

const estaGuardada = id => biblioteca.some(c => c.trackId === id);

function alternarGuardada(cancion) {
    if (estaGuardada(cancion.trackId)) {
        biblioteca = biblioteca.filter(c => c.trackId !== cancion.trackId);
    } else {
        biblioteca.unshift(cancion);
    }
    guardarBiblioteca();
    if (vista === 'biblioteca') mostrarBiblioteca();
}

// ---------- Utilidades ----------
function el(etiqueta, clase, texto) {
    const nodo = document.createElement(etiqueta);
    if (clase) nodo.className = clase;
    if (texto != null) nodo.textContent = texto;
    return nodo;
}

function icono(d) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', d);
    svg.append(path);
    return svg;
}

function formatoTiempo(segundos) {
    if (!isFinite(segundos)) return '0:00';
    const s = Math.floor(segundos);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function mostrarEstado(mensaje) {
    elEstado.textContent = mensaje;
    elEstado.hidden = !mensaje;
}

// Deja solo los campos que usa la página (así la biblioteca guardada pesa poco)
function simplificar(song) {
    return {
        trackId: song.trackId,
        trackName: song.trackName || 'Sin título',
        artistName: song.artistName || 'Artista desconocido',
        collectionName: song.collectionName || '',
        // iTunes entrega la portada en 100x100; se pide una más grande cambiando la medida
        portada: (song.artworkUrl100 || '').replace('100x100bb', '400x400bb'),
        previewUrl: song.previewUrl || '',
    };
}

// ---------- Búsqueda ----------
async function searchMusic(term) {
    const turno = ++busquedaEnCurso;
    songsContainer.innerHTML = '';
    mostrarEstado('Buscando…');

    try {
        const url = `${API}?term=${encodeURIComponent(term)}&entity=song&limit=24&country=MX`;
        const response = await fetch(url);
        if (!response.ok) throw new Error(`iTunes respondió ${response.status}`);
        const data = await response.json();
        if (turno !== busquedaEnCurso) return; // llegó tarde: ya hay otra búsqueda

        const canciones = (data.results || []).filter(s => s.trackId).map(simplificar);
        if (canciones.length === 0) {
            mostrarEstado(`No hay canciones para "${term}". Revisa cómo está escrito o prueba con otro artista.`);
            return;
        }
        mostrarEstado('');
        displaySongs(canciones);
    } catch (error) {
        if (turno !== busquedaEnCurso) return;
        console.error(error);
        mostrarEstado('No se pudo conectar con iTunes. Revisa tu conexión a internet y vuelve a buscar.');
    }
}

// ---------- Tarjetas ----------
function displaySongs(canciones) {
    songsContainer.innerHTML = '';
    canciones.forEach(cancion => songsContainer.append(crearTarjeta(cancion)));
    marcarSonando();
}

function crearTarjeta(cancion) {
    const tarjeta = el('article', 'song-card');
    tarjeta.dataset.id = cancion.trackId;

    const caja = el('div', 'portada');
    const img = el('img');
    img.src = cancion.portada;
    img.alt = `Portada de ${cancion.collectionName || cancion.trackName}`;
    img.loading = 'lazy';
    img.addEventListener('error', () => img.remove()); // sin portada queda el fondo gris
    caja.append(img);

    const btnPlay = el('button', 'btn-play');
    btnPlay.type = 'button';
    if (cancion.previewUrl) {
        btnPlay.setAttribute('aria-label', `Reproducir ${cancion.trackName}`);
        btnPlay.append(icono(ICONO_PLAY));
        btnPlay.addEventListener('click', () => reproducir(cancion));
    } else {
        btnPlay.disabled = true;
        btnPlay.textContent = 'Sin audio';
        btnPlay.classList.add('sin-audio');
    }
    caja.append(btnPlay);

    const btnGustar = el('button', 'btn-gustar');
    btnGustar.type = 'button';
    btnGustar.append(icono(ICONO_CORAZON));
    const pintarCorazon = () => {
        const guardada = estaGuardada(cancion.trackId);
        btnGustar.classList.toggle('activo', guardada);
        btnGustar.setAttribute('aria-pressed', guardada);
        btnGustar.setAttribute('aria-label', guardada ? 'Quitar de tu biblioteca' : 'Guardar en tu biblioteca');
    };
    pintarCorazon();
    btnGustar.addEventListener('click', () => { alternarGuardada(cancion); pintarCorazon(); });

    const titulo = el('h3', null, cancion.trackName);
    titulo.title = cancion.trackName;
    const pie = el('div', 'tarjeta-pie');
    const textos = el('div', 'tarjeta-textos');
    textos.append(titulo, el('p', null, cancion.artistName), el('p', 'album-text', cancion.collectionName));
    pie.append(textos, btnGustar);

    tarjeta.append(caja, pie);
    return tarjeta;
}

// ---------- Reproductor ----------
function reproducir(cancion) {
    if (cancionActual === cancion.trackId) {
        audio.paused ? audio.play() : audio.pause();
        return;
    }
    cancionActual = cancion.trackId;
    audio.src = cancion.previewUrl;
    audio.play().catch(() => mostrarEstado('El navegador no pudo reproducir este fragmento.'));

    document.getElementById('repPortada').src = cancion.portada;
    document.getElementById('repPortada').alt = '';
    document.getElementById('repTitulo').textContent = cancion.trackName;
    document.getElementById('repArtista').textContent = cancion.artistName;
    reproductor.hidden = false;
    document.body.classList.add('con-reproductor');
}

// Pinta qué tarjeta está sonando y el icono de play/pausa
function marcarSonando() {
    const sonando = !audio.paused && !audio.ended;
    document.querySelectorAll('.song-card').forEach(tarjeta => {
        const esEsta = Number(tarjeta.dataset.id) === cancionActual;
        tarjeta.classList.toggle('sonando', esEsta);
        const path = tarjeta.querySelector('.btn-play path');
        if (path) path.setAttribute('d', esEsta && sonando ? ICONO_PAUSA : ICONO_PLAY);
    });
    repIcono.setAttribute('d', sonando ? ICONO_PAUSA : ICONO_PLAY);
    repPlay.setAttribute('aria-label', sonando ? 'Pausar' : 'Reproducir');
}

audio.addEventListener('play', marcarSonando);
audio.addEventListener('pause', marcarSonando);
audio.addEventListener('ended', () => { repBarra.value = 0; repActual.textContent = '0:00'; marcarSonando(); });
audio.addEventListener('loadedmetadata', () => { repTotal.textContent = formatoTiempo(audio.duration); });
audio.addEventListener('timeupdate', () => {
    if (!audio.duration) return;
    repBarra.value = (audio.currentTime / audio.duration) * 100;
    repActual.textContent = formatoTiempo(audio.currentTime);
});
audio.addEventListener('error', () => {
    if (audio.src) mostrarEstado('Este fragmento ya no está disponible en iTunes.');
});

repPlay.addEventListener('click', () => { audio.paused ? audio.play() : audio.pause(); });
repBarra.addEventListener('input', () => {
    if (audio.duration) audio.currentTime = (repBarra.value / 100) * audio.duration;
});

// ---------- Vistas ----------
function cambiarVista(nueva) {
    vista = nueva;
    document.querySelectorAll('.menu-item').forEach(b => b.classList.toggle('activo', b.dataset.vista === nueva));

    if (nueva === 'inicio') {
        elTitulo.textContent = 'Explora música';
        elSubtitulo.textContent = 'Para empezar';
        elSugerencias.hidden = false;
        searchInput.value = '';
        searchMusic(SUGERENCIAS[0]);
    } else if (nueva === 'buscar') {
        elTitulo.textContent = 'Buscar';
        elSugerencias.hidden = false;
        searchInput.focus();
    } else {
        mostrarBiblioteca();
    }
}

function mostrarBiblioteca() {
    busquedaEnCurso++; // cancela cualquier búsqueda pendiente
    elTitulo.textContent = 'Tu biblioteca';
    elSubtitulo.textContent = biblioteca.length === 1 ? '1 canción guardada' : `${biblioteca.length} canciones guardadas`;
    elSugerencias.hidden = true;
    if (biblioteca.length === 0) {
        songsContainer.innerHTML = '';
        mostrarEstado('Aún no guardas canciones. Toca el corazón de una canción para tenerla aquí.');
        return;
    }
    mostrarEstado('');
    displaySongs(biblioteca);
}

function buscar(termino) {
    vista = 'buscar';
    document.querySelectorAll('.menu-item').forEach(b => b.classList.toggle('activo', b.dataset.vista === 'buscar'));
    elTitulo.textContent = 'Buscar';
    elSubtitulo.textContent = `Resultados de "${termino}"`;
    elSugerencias.hidden = false;
    searchMusic(termino);
}

// ---------- Eventos ----------
searchForm.addEventListener('submit', e => {
    e.preventDefault();
    const termino = searchInput.value.trim();
    if (termino === '') {
        mostrarEstado('Escribe un artista, una canción o un álbum.');
        searchInput.focus();
        return;
    }
    buscar(termino);
});

document.querySelectorAll('.menu-item').forEach(boton => {
    boton.addEventListener('click', () => cambiarVista(boton.dataset.vista));
});

SUGERENCIAS.forEach(nombre => {
    const chip = el('button', 'chip', nombre);
    chip.type = 'button';
    chip.addEventListener('click', () => { searchInput.value = nombre; buscar(nombre); });
    elSugerencias.append(chip);
});

// Barra espaciadora: pausa o reanuda (si no se está escribiendo)
document.addEventListener('keydown', e => {
    const escribiendo = ['INPUT', 'TEXTAREA', 'BUTTON'].includes(document.activeElement.tagName);
    if (e.code === 'Space' && !escribiendo && cancionActual) {
        e.preventDefault();
        audio.paused ? audio.play() : audio.pause();
    }
});

// ---------- Carga inicial ----------
guardarBiblioteca();
cambiarVista('inicio');
