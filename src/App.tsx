import JSONCrush from 'jsoncrush';
import { nanoid } from 'nanoid';
import { useEffect, useState, useMemo, useCallback } from 'react';
import { Rnd } from 'react-rnd';
import { Socket, io } from 'socket.io-client';

import style from './content.module.scss';

type RnDObject = Record<
  string,
  {
    id: string;
    size: { width: string; height: string };
    position: { x: number; y: number };
    data: string;
  }
>;

let socket: Socket | null = null;

function App() {
  const [rndData, setRndObject] = useState<RnDObject>({});

  const [dirty, setDirty] = useState(false);
  const [variables, setVariables] = useState({});

  const [edit, setEdit] = useState(false);

  const params = new URLSearchParams(window.location.search);
  const data = params.get('data');
  useMemo(() => {
    if (data) {
      setRndObject(JSON.parse(JSONCrush.uncrush(data)));
    }
  }, [data]);

  const server = params.get('server');
  useMemo(() => {
    if (server) {
      socket = io(server);
    }
  }, [server]);

  const save = (newRndData: object) => {
    params.set('data', JSONCrush.crush(JSON.stringify(newRndData)));
    window.location.search = params.toString();
  };

  useEffect(() => {
    const intervafl = setInterval(() => {
      socket?.emit(
        'variables:instance-values',
        'internal',
        (err: Error, res: unknown) => {
          if (err) {
            console.error(err);
          } else {
            setVariables({ internal: res });
          }
        }
      );
    }, 1000);

    return () => {
      clearInterval(intervafl);
    };
  }, []);

  const setRndPosition = useCallback(
    (id: keyof RnDObject, x: number, y: number) => {
      const newRndData = {
        ...rndData,
        [id]: {
          ...rndData[id],
          position: { x, y },
        },
      };
      setRndObject(newRndData);
      setDirty(true);
    },
    [rndData]
  );

  const setRndData = useCallback(
    (id: keyof RnDObject, data: string) => {
      const newRndData = {
        ...rndData,
        [id]: {
          ...rndData[id],
          data,
        },
      };
      setRndObject(newRndData);
      setDirty(true);
    },
    [rndData]
  );

  const setRndSize = useCallback(
    (
      id: keyof RnDObject,
      width: string,
      height: string,
      position: { x: number; y: number }
    ) => {
      const newRndData = {
        ...rndData,
        [id]: { ...rndData[id], size: { width, height }, position },
      };
      setRndObject(newRndData);
      setDirty(true);
    },
    [rndData]
  );

  const removeElement = useCallback(
    (id: keyof RnDObject) => {
      const obj = { ...rndData };
      delete obj[id];
      setRndObject(obj);
    },
    [rndData]
  );

  const addElement = useCallback(() => {
    const newId = nanoid(5);
    const obj = {
      ...rndData,
      [newId]: {
        id: newId,
        size: { width: '70px', height: '70px' },
        position: { x: 0, y: 0 },
        data: 'internal:time_hms',
      },
    };
    setRndObject(obj);
  }, [rndData]);

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
      }}
    >
      {Object.values(rndData).map((elm) => (
        <Rnd
          key={elm.id}
          size={elm.size}
          position={elm.position}
          dragGrid={[10, 10]}
          resizeGrid={[10, 10]}
          minHeight={70}
          minWidth={70}
          className={style.rndElement}
          onDragStop={(_e, position) => {
            setRndPosition(elm.id, position.x, position.y);
          }}
          onResizeStop={(_e, _direction, ref, _delta, position) => {
            setRndSize(elm.id, ref.style.width, ref.style.height, position);
          }}
        >
          {!edit && (
            <div
              className={style.data}
              style={{ fontSize: elm.size?.height ?? '70px' }}
            >
              {getVariable(elm.data, variables)}
            </div>
          )}
          {edit && (
            <div>
              <button
                style={{ backgroundColor: 'red' }}
                onClick={() => removeElement(elm.id)}
              >
                X
              </button>
              <input
                className={style.data}
                style={{ fontSize: 'xx-large' }}
                onChange={(e) => setRndData(elm.id, e.target.value)}
                value={elm.data}
              />
            </div>
          )}
        </Rnd>
      ))}
      <div className={style.editRow}>
        <button onClick={() => save(rndData)} hidden={!dirty}>
          🖫
        </button>
        <button
          className={edit ? style.editButtonActive : style.editButton}
          onClick={() => setEdit(!edit)}
        >
          ✎
        </button>
        <button className={style.editButton} onClick={() => addElement()}>
          +
        </button>
      </div>
    </div>
  );
}

export default App;

function getVariable(key: string, variables: object) {
  if (!key || typeof key !== 'string') {
    return 'N/A';
  }
  const [a, b] = key.split(':');
  if (a in variables) {
    const group = variables[a as keyof typeof variables];
    if (b in group) {
      return group[b];
    }
  }
  return 'N/A';
}
