import * as $protobuf from "protobufjs";
import Long = require("long");
/** Namespace master. */
export namespace master {

    /** Properties of a Player. */
    interface IPlayer {

        /** Player name */
        name?: (string|null);

        /** Player identifiers */
        identifiers?: (string[]|null);

        /** Player endpoint */
        endpoint?: (string|null);

        /** Player ping */
        ping?: (number|null);

        /** Player id */
        id?: (number|null);
    }

    /** Represents a Player. */
    class Player implements IPlayer {

        /**
         * Constructs a new Player.
         * @param [properties] Properties to set
         */
        constructor(properties?: master.IPlayer);

        /** Player name. */
        public name: string;

        /** Player identifiers. */
        public identifiers: string[];

        /** Player endpoint. */
        public endpoint: string;

        /** Player ping. */
        public ping: number;

        /** Player id. */
        public id: number;

        /**
         * Creates a new Player instance using the specified properties.
         * @param [properties] Properties to set
         * @returns Player instance
         */
        public static create(properties?: master.IPlayer): master.Player;

        /**
         * Encodes the specified Player message. Does not implicitly {@link master.Player.verify|verify} messages.
         * @param message Player message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(message: master.IPlayer, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Encodes the specified Player message, length delimited. Does not implicitly {@link master.Player.verify|verify} messages.
         * @param message Player message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(message: master.IPlayer, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes a Player message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns Player
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): master.Player;

        /**
         * Decodes a Player message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns Player
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): master.Player;

        /**
         * Verifies a Player message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): (string|null);

        /**
         * Creates a Player message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns Player
         */
        public static fromObject(object: { [k: string]: any }): master.Player;

        /**
         * Creates a plain object from a Player message. Also converts values to other types if specified.
         * @param message Player
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(message: master.Player, options?: $protobuf.IConversionOptions): { [k: string]: any };

        /**
         * Converts this Player to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for Player
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a ServerData. */
    interface IServerData {

        /** ServerData svMaxclients */
        svMaxclients?: (number|null);

        /** ServerData clients */
        clients?: (number|null);

        /** ServerData protocol */
        protocol?: (number|null);

        /** ServerData hostname */
        hostname?: (string|null);

        /** ServerData gametype */
        gametype?: (string|null);

        /** ServerData mapname */
        mapname?: (string|null);

        /** ServerData resources */
        resources?: (string[]|null);

        /** ServerData server */
        server?: (string|null);

        /** ServerData players */
        players?: (master.IPlayer[]|null);

        /** ServerData iconVersion */
        iconVersion?: (number|null);

        /** ServerData vars */
        vars?: ({ [k: string]: string }|null);

        /** ServerData enhancedHostSupport */
        enhancedHostSupport?: (boolean|null);

        /** ServerData upvotePower */
        upvotePower?: (number|null);

        /** ServerData connectEndPoints */
        connectEndPoints?: (string[]|null);

        /** ServerData burstPower */
        burstPower?: (number|null);
    }

    /** Represents a ServerData. */
    class ServerData implements IServerData {

        /**
         * Constructs a new ServerData.
         * @param [properties] Properties to set
         */
        constructor(properties?: master.IServerData);

        /** ServerData svMaxclients. */
        public svMaxclients: number;

        /** ServerData clients. */
        public clients: number;

        /** ServerData protocol. */
        public protocol: number;

        /** ServerData hostname. */
        public hostname: string;

        /** ServerData gametype. */
        public gametype: string;

        /** ServerData mapname. */
        public mapname: string;

        /** ServerData resources. */
        public resources: string[];

        /** ServerData server. */
        public server: string;

        /** ServerData players. */
        public players: master.IPlayer[];

        /** ServerData iconVersion. */
        public iconVersion: number;

        /** ServerData vars. */
        public vars: { [k: string]: string };

        /** ServerData enhancedHostSupport. */
        public enhancedHostSupport: boolean;

        /** ServerData upvotePower. */
        public upvotePower: number;

        /** ServerData connectEndPoints. */
        public connectEndPoints: string[];

        /** ServerData burstPower. */
        public burstPower: number;

        /**
         * Creates a new ServerData instance using the specified properties.
         * @param [properties] Properties to set
         * @returns ServerData instance
         */
        public static create(properties?: master.IServerData): master.ServerData;

        /**
         * Encodes the specified ServerData message. Does not implicitly {@link master.ServerData.verify|verify} messages.
         * @param message ServerData message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(message: master.IServerData, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Encodes the specified ServerData message, length delimited. Does not implicitly {@link master.ServerData.verify|verify} messages.
         * @param message ServerData message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(message: master.IServerData, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes a ServerData message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns ServerData
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): master.ServerData;

        /**
         * Decodes a ServerData message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns ServerData
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): master.ServerData;

        /**
         * Verifies a ServerData message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): (string|null);

        /**
         * Creates a ServerData message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns ServerData
         */
        public static fromObject(object: { [k: string]: any }): master.ServerData;

        /**
         * Creates a plain object from a ServerData message. Also converts values to other types if specified.
         * @param message ServerData
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(message: master.ServerData, options?: $protobuf.IConversionOptions): { [k: string]: any };

        /**
         * Converts this ServerData to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for ServerData
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a Server. */
    interface IServer {

        /** Server EndPoint */
        EndPoint?: (string|null);

        /** Server Data */
        Data?: (master.IServerData|null);
    }

    /** Represents a Server. */
    class Server implements IServer {

        /**
         * Constructs a new Server.
         * @param [properties] Properties to set
         */
        constructor(properties?: master.IServer);

        /** Server EndPoint. */
        public EndPoint: string;

        /** Server Data. */
        public Data?: (master.IServerData|null);

        /**
         * Creates a new Server instance using the specified properties.
         * @param [properties] Properties to set
         * @returns Server instance
         */
        public static create(properties?: master.IServer): master.Server;

        /**
         * Encodes the specified Server message. Does not implicitly {@link master.Server.verify|verify} messages.
         * @param message Server message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(message: master.IServer, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Encodes the specified Server message, length delimited. Does not implicitly {@link master.Server.verify|verify} messages.
         * @param message Server message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(message: master.IServer, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes a Server message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns Server
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): master.Server;

        /**
         * Decodes a Server message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns Server
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): master.Server;

        /**
         * Verifies a Server message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): (string|null);

        /**
         * Creates a Server message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns Server
         */
        public static fromObject(object: { [k: string]: any }): master.Server;

        /**
         * Creates a plain object from a Server message. Also converts values to other types if specified.
         * @param message Server
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(message: master.Server, options?: $protobuf.IConversionOptions): { [k: string]: any };

        /**
         * Converts this Server to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for Server
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }
}
