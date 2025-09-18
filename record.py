from flask import Flask, Response, render_template, request, redirect, url_for, send_file
import pyaudio
import cv2
import threading
import time
import datetime

app = Flask(__name__)

# =========================
# Configuración de audio
# =========================
CHUNK = 1024
FORMAT = pyaudio.paInt16
audio_mode = "normal"
CHANNELS = 1 if audio_mode == "normal" else 2
RATE = 44100

p = pyaudio.PyAudio()
current_device_index = None

def listar_dispositivos_entrada():
    dispositivos = []
    for i in range(p.get_device_count()):
        info = p.get_device_info_by_index(i)
        if info.get('maxInputChannels', 0) > 0:
            dispositivos.append({
                'index': i,
                'name': info.get('name'),
                'maxInputChannels': info.get('maxInputChannels')
            })
    return dispositivos

def create_wav_header(rate, channels):
    byte_rate = rate * channels * 2  # 16-bit audio
    wav_header = bytes("RIFF", "ascii")
    wav_header += (36 + 1000000000).to_bytes(4, 'little')
    wav_header += bytes("WAVE", "ascii")
    wav_header += bytes("fmt ", "ascii")
    wav_header += (16).to_bytes(4, 'little')
    wav_header += (1).to_bytes(2, 'little')
    wav_header += (channels).to_bytes(2, 'little')
    wav_header += (rate).to_bytes(4, 'little')
    wav_header += (byte_rate).to_bytes(4, 'little')
    wav_header += (channels * 2).to_bytes(2, 'little')
    wav_header += (16).to_bytes(2, 'little')
    wav_header += bytes("data", "ascii")
    wav_header += (1000000000).to_bytes(4, 'little')
    return wav_header

def generate_audio_stream():
    stream_params = {
        'format': FORMAT,
        'channels': CHANNELS,
        'rate': RATE,
        'input': True,
        'frames_per_buffer': CHUNK
    }
    if current_device_index is not None:
        stream_params['input_device_index'] = current_device_index
    stream = p.open(**stream_params)
    wav_header = create_wav_header(RATE, CHANNELS)
    yield wav_header
    try:
        while True:
            data = stream.read(CHUNK)
            yield data
    except GeneratorExit:
        stream.stop_stream()
        stream.close()

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/audio_feed')
def audio_feed():
    return Response(generate_audio_stream(), mimetype="audio/wav")

@app.route('/dispositivos', methods=['GET', 'POST'])
def dispositivos():
    global current_device_index, audio_mode, CHANNELS
    if request.method == 'POST':
        selected_device = request.form.get('device_index')
        if selected_device is not None and selected_device != "":
            current_device_index = int(selected_device)
        else:
            current_device_index = None
        mode = request.form.get('mode')
        if mode:
            audio_mode = mode
            CHANNELS = 2 if audio_mode == "ambient" else 1
        return redirect(url_for('index'))
    else:
        devices = listar_dispositivos_entrada()
        return render_template('dispositivos.html', devices=devices, current_device=current_device_index, audio_mode=audio_mode)

# ======================================
# Sección de video: grabación y streaming
# ======================================

# Variables globales para video
recording = False
record_thread = None
video_file = "recorded_video.avi"
video_capture = None
current_frame = None

def record_video():
    """
    Abre la cámara, actualiza current_frame para el streaming MJPEG y escribe los frames en video_file.
    Esta función se ejecuta en un hilo mientras 'recording' sea True.
    """
    global recording, video_capture, current_frame, video_file
    # Abrir la cámara cuando se inicia la grabación
    video_capture = cv2.VideoCapture(0, cv2.CAP_DSHOW)
    if not video_capture.isOpened():
        print("No se pudo abrir la cámara")
        return
    ret, frame = video_capture.read()
    if not ret:
        video_capture.release()
        print("No se pudo leer un frame")
        return
    current_frame = frame.copy()
    height, width, _ = frame.shape
    fourcc = cv2.VideoWriter_fourcc(*'XVID')
    video_writer = cv2.VideoWriter(video_file, fourcc, 20.0, (width, height))
    while recording:
        ret, frame = video_capture.read()
        if not ret:
            break
        current_frame = frame.copy()
        video_writer.write(frame)
        time.sleep(1/20)
    video_writer.release()
    video_capture.release()
    video_capture = None
    current_frame = None

@app.route('/start_recording')
def start_recording():
    """Endpoint para iniciar la grabación de video con un archivo único."""
    global recording, record_thread, video_file
    if not recording:
        # Genera un nombre de archivo único usando la fecha y hora actual
        timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
        video_file = f"recorded_video_{timestamp}.avi"
        recording = True
        record_thread = threading.Thread(target=record_video)
        record_thread.start()
        return "Grabación iniciada"
    else:
        return "Ya se está grabando"

@app.route('/pause_recording')
def pause_recording():
    """
    Detiene la grabación y apaga la cámara.
    Al pausarse, se finaliza la grabación y el streaming de video se detiene.
    """
    global recording, record_thread
    if recording:
        recording = False
        if record_thread is not None:
            record_thread.join()
        return "Grabación pausada"
    else:
        return "No se está grabando"

@app.route('/download_video')
def download_video():
    return send_file(video_file, as_attachment=True)

def gen_video_feed():
    """
    Generador para el streaming MJPEG del video en vivo.
    Si current_frame tiene valor (grabación en curso), se codifica y envía.
    Cuando se pausa la grabación, current_frame queda en None y no se envían frames.
    """
    global current_frame
    while True:
        if current_frame is not None:
            ret, jpeg = cv2.imencode('.jpg', current_frame)
            if ret:
                frame = jpeg.tobytes()
                yield (b'--frame\r\n'
                       b'Content-Type: image/jpeg\r\n\r\n' + frame + b'\r\n')
        else:
            time.sleep(0.1)
        time.sleep(0.03)

@app.route('/video_feed')
def video_feed():
    return Response(gen_video_feed(), mimetype='multipart/x-mixed-replace; boundary=frame')

# ======================================
# Captura de imagen (usa current_frame)
# ======================================
@app.route('/capture')
def capture():
    global current_frame
    if current_frame is None:
        # Si no hay un frame activo, abrir la cámara temporalmente para capturar la imagen
        cap = cv2.VideoCapture(0, cv2.CAP_DSHOW)
        ret, frame = cap.read()
        cap.release()
        if not ret:
            return "Error al capturar la imagen", 500
    else:
        frame = current_frame
    ret, jpeg = cv2.imencode('.jpg', frame)
    if not ret:
        return "Error al codificar la imagen", 500
    return Response(jpeg.tobytes(), mimetype='image/jpeg')


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True, threaded=True)
