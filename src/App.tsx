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
  const [connectionList, setConnectionList] = useState<string[]>([]);

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

  const addConnectionsList = useCallback(
    (val: string) => {
      setConnectionList([...connectionList, val]);
    },
    [connectionList]
  );

  const save = (newRndData: object) => {
    params.set('data', JSONCrush.crush(JSON.stringify(newRndData)));
    window.location.search = params.toString();
  };

  const interval = Number(params.get('interval') ?? 1) * 1000;
  useEffect(() => {
    const intervafl = setInterval(() => {
      for (const index in connectionList) {
        const connection = connectionList[index];
        socket?.emit(
          'variables:instance-values',
          [connection],
          (err: Error, res: unknown) => {
            if (err) {
              console.error(err);
            } else {
              setVariables((v) => {
                return { ...v, [connection]: res };
              });
            }
          }
        );
      }
    }, interval);

    return () => {
      console.log('clear interval');
      clearInterval(intervafl);
    };
  }, [interval, connectionList]);

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
        size: { width: '700px', height: '70px' },
        position: { x: 10, y: 0 },
        data: 'Pre $(internal:time_hms) Post',
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
              {getVariable(
                elm.data,
                variables,
                connectionList,
                addConnectionsList
              )}
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

// https://github.com/bitfocus/companion/blob/3a38cb00138637f323536383904ab5a56fffc032/companion/lib/Instance/Variable.js#L46
function getVariable(
  key: string,
  variables: object,
  connectionsList: string[], //TODO: how to unsubscribe
  addConnectionsList: (val: string) => void
) {
  if (!key || typeof key !== 'string') {
    return String(key);
  }

  const reg = /\$\(([^:$)]+):([^)$]+)\)/;

  const match = reg.exec(key);

  if (!match) {
    return key;
  }

  const fullId = match[0];
  const connectionLabel = match[1];
  const variableId = match[2];

  console.log(variables);

  if (!connectionsList.some((val) => connectionLabel == val)) {
    addConnectionsList(connectionLabel);
    console.info(connectionLabel, 'not in connection list adding');
    return key.replace(fullId, 'N/A');
  }

  if (!(connectionLabel in variables)) {
    console.warn(connectionLabel, 'still not found in returned variables');
    return key.replace(fullId, 'N/A');
  }

  const connectionVariable =
    variables[connectionLabel as keyof typeof variables];

  if (!connectionVariable || !(variableId in connectionVariable)) {
    return key.replace(fullId, 'N/A');
  }

  return key.replace(fullId, connectionVariable[variableId]);
}
