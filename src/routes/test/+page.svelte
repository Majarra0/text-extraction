<script lang="ts">
  import { onMount } from 'svelte';
  import { buildWebSocketUrl, toAbsoluteUrl } from '$lib/config';
  import { UPLOADS_SOCKET_PATH } from '$lib/api/uploadsSocket';
    interface PhotoInfo {
        id: number;
        src: string;
        width: number;
        height: number;
        status: string;
    }
  let photos: PhotoInfo[] = [];
  let socket: WebSocket | undefined;
  
  onMount(() => {
    // add token handling if your backend requires it
    const token = localStorage.getItem('access');
    const url = buildWebSocketUrl(UPLOADS_SOCKET_PATH , { token: `${token}` } );
    console.log(url);
    socket = new WebSocket(url);
    socket.onopen = () => {
      console.log("Connected to backend");
    };

    socket.onmessage = (event) => {
      console.log(`[onmessage] Ln :`, event.data);
      const data = event.data;

      if (typeof data === 'string') {
        try {
          const payload = JSON.parse(data);

          if (Array.isArray(payload.list)) {
            console.log(`[list] Ln  `, payload.list);
            for (const item of payload.list) {
              if (item.image_url) {
                handleImage(toAbsoluteUrl(item.image_url));
              }
            }
            return;
          }

          if (payload.instance?.image_url) {
            console.log(`[instance] Ln :`, payload.instance);
            handleImage(toAbsoluteUrl(payload.instance.image_url));
            return;
          }
        } catch (error) {
          console.error(`[JSON parse] Ln:`, error);
        }

        handleImage(`data:image/jpeg;base64,${data}`);
        return;
      }

      if (data instanceof Blob || data instanceof ArrayBuffer) {
        const blob = data instanceof Blob ? data : new Blob([data], { type: 'image/jpeg' });
        console.log(`[blob] Ln:`, blob);
        handleImage(URL.createObjectURL(blob));
      }
    };
    socket.onclose = ()=>{
      socket?.close();

    }
    // return () => {
    //   socket?.close();
    // };
    async function handleImage(initialSrc: string) {
      const token = localStorage.getItem('access');
      const headers: HeadersInit | undefined = token
        ? { Authorization: `Bearer ${token}` }
        : undefined;
      let src = initialSrc;

      if (headers && !initialSrc.startsWith('data:') && !initialSrc.startsWith('blob:')) {
        try {
          const response = await fetch(initialSrc, { headers });
          if (!response.ok) {
            console.error('Failed to fetch protected image:', response.status);
            return;
          }
          const blob = await response.blob();
          src = URL.createObjectURL(blob);
        } catch (error) {
          console.error('Failed to fetch protected image:', error);
          return;
        }
      }

      const img = new Image();
      img.crossOrigin = 'Anonymous';
      img.onload = () => {
        photos = [
          ...photos,
          {
            id: photos.length + 1,
            src,
            width: img.width,
            height: img.height,
            status: '✅ Loaded'
          }
        ];
      };
      img.onerror = (error) => {
        console.error('Failed to load image element:', error);
      };
      img.src = src;
    }
  });
</script>
<style>
  table {
    border-collapse: collapse;
    width: 100%;
  }
  th, td {
    border: 1px solid #ccc;
    padding: 6px;
    text-align: center;
  }
  img {
    max-width: 50px;
    max-height: 50px;
  }
</style>

<table>
  <thead>
    <tr>
      <th>#</th>
      <th>Preview</th>
      <th>Dimensions</th>
      <th>Status</th>
    </tr>
  </thead>
  <tbody>
    {#each photos as photo}
      <tr>
        <td>{photo.id}</td>
        <td><img src={photo.src} alt="preview" /></td>
        <td>{photo.width} x {photo.height}</td>
        <td>{photo.status}</td>
      </tr>
    {/each}
  </tbody>
</table>
